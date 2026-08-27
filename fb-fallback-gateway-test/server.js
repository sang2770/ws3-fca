const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
let login = null;
try {
  login = require('ws3-fca');
} catch (e) {
  console.log('[WARN] ws3-fca package is not installed. Please run: npm install');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve Web UI from public folder
app.use(express.static(path.join(__dirname, 'public')));

const PORT = 4000;
const APP_STATE_PATH = path.join(__dirname, 'appstate.json');

let fbApi = null;

function initFacebook() {
  if (!fs.existsSync(APP_STATE_PATH)) {
    console.log('[WARN] appstate.json file not found!');
    console.log('[INFO] Please export your FB cookies to scripts/fb-fallback-gateway-test/appstate.json to start.');
    return;
  }

  if (!login) {
    console.log('[WARN] ws3-fca library is not loaded.');
    return;
  }

  try {
    const appState = JSON.parse(fs.readFileSync(APP_STATE_PATH, 'utf8'));

    console.log('[INFO] Connecting to Facebook using AppState...');
    login({ appState }, (err, api) => {
      if (err) {
        console.error('[ERROR] Facebook login failed:', err);
        return;
      }

      fbApi = api;
      console.log('[SUCCESS] Connected to Facebook successfully!');

      // Auto-save refreshed cookies to file
      try {
        fs.writeFileSync(APP_STATE_PATH, JSON.stringify(api.getAppState(), null, 2), 'utf8');
        console.log('[INFO] Successfully updated appstate.json with refreshed session.');
      } catch (saveErr) {
        console.warn('[WARN] Failed to write appstate.json:', saveErr.message);
      }

      // Real-time MQTT message listener
      api.listenMqtt((listenErr, message) => {
        if (listenErr) {
          console.error('[ERROR] MQTT listen error:', listenErr);
          return;
        }

        if (message && message.type === 'message') {
          const bodyText = message.body || '[Attachment / Sticker]';
          console.log('[INCOMING MESSAGE] From ID: ' + message.senderID + ' | ThreadID: ' + message.threadID + ' | Body: ' + bodyText);
        }
      });
    });
  } catch (parseErr) {
    console.error('[ERROR] Failed to parse appstate.json:', parseErr.message);
  }
}

// 1. Health check
app.get('/health', (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json({
    status: fbApi ? 'ready' : 'waiting_for_appstate',
    hasAppState: fs.existsSync(APP_STATE_PATH)
  });
});

// 2. GET FANPAGE LIST (Profile Switcher / Pages Admin)
app.get('/api/pages', async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!fbApi) {
    return res.status(503).json({ success: false, error: 'Gateway is not connected to Facebook.' });
  }

  try {
    const currentUserID = fbApi.getCurrentUserID ? fbApi.getCurrentUserID() : 'Personal';

    const docIdQuery = {
      doc_id: '5877847998967912',
      variables: JSON.stringify({ scale: 1 })
    };

    fbApi.httpPost('https://www.facebook.com/api/graphql/', docIdQuery, (err, data) => {
      let pageList = [];

      if (!err && data) {
        try {
          const parsed = typeof data === 'string' ? JSON.parse(data.replace('for (;;);', '')) : data;
          const edges = parsed?.data?.viewer?.actor?.profile_switcher_eligible_profiles?.edges || [];
          pageList = edges.map(e => ({
            pageId: e.node.id,
            name: e.node.name,
            avatar: e.node.profile_picture?.uri || ''
          }));
        } catch (parseEx) {}
      }

      const resultPages = [
        {
          pageId: '',
          name: 'Personal Account (' + currentUserID + ')',
          isPersonal: true
        },
        ...pageList
      ];

      return res.json({
        success: true,
        pages: resultPages
      });
    });

  } catch (error) {
    return res.json({
      success: true,
      pages: [
        { pageId: '', name: 'Personal Account', isPersonal: true }
      ]
    });
  }
});

// 3. GET CONVERSATION LIST (Thread List)
app.get('/api/threads', (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!fbApi) {
    return res.status(503).json({ success: false, error: 'Gateway is not connected to Facebook.' });
  }

  const limit = parseInt(req.query.limit, 10) || 20;
  const timestamp = req.query.timestamp ? parseInt(req.query.timestamp, 10) : null;
  const tags = req.query.tags ? [req.query.tags] : ['INBOX'];
  const pageId = req.query.pageId;

  if (pageId) {
    fbApi.setOptions({ pageID: pageId.toString() });
  } else {
    fbApi.setOptions({ pageID: '' });
  }

  fbApi.getThreadList(limit, timestamp, tags, (err, list) => {
    if (err) {
      console.error('[ERROR] Failed to fetch thread list:', err);
      return res.status(500).json({ success: false, error: err });
    }

    const threads = (list || []).map(t => ({
      threadID: t.threadID,
      name: t.name || t.threadName || 'Facebook User',
      unreadCount: t.unreadCount || 0,
      snippet: t.snippet || '',
      timestamp: t.timestamp,
      isGroup: t.isGroup,
      participantIDs: t.participantIDs
    }));

    return res.json({
      success: true,
      count: threads.length,
      threads: threads
    });
  });
});

// 4. GET MESSAGE HISTORY OF A THREAD
app.get('/api/threads/:threadId/messages', (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!fbApi) {
    return res.status(503).json({ success: false, error: 'Gateway is not connected to Facebook.' });
  }

  const threadId = req.params.threadId;
  const limit = parseInt(req.query.limit, 10) || 30;
  const timestamp = req.query.timestamp ? parseInt(req.query.timestamp, 10) : null;
  const pageId = req.query.pageId;

  if (pageId) {
    fbApi.setOptions({ pageID: pageId.toString() });
  } else {
    fbApi.setOptions({ pageID: '' });
  }

  fbApi.getThreadHistory(threadId, limit, timestamp, (err, history) => {
    if (err) {
      console.error('[ERROR] Failed to fetch message history for ' + threadId + ':', err);
      return res.status(500).json({ success: false, error: err });
    }

    return res.json({
      success: true,
      threadId,
      messages: history
    });
  });
});

// 5. SEND MESSAGE API
app.post('/api/send-message', (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const { recipientId, message, pageId } = req.body;

  if (!fbApi) {
    return res.status(503).json({
      success: false,
      error: 'Gateway is not connected. Please check appstate.json.'
    });
  }

  if (!recipientId || !message) {
    return res.status(400).json({
      success: false,
      error: 'Missing recipientId or message in request body.'
    });
  }

  try {
    if (pageId) {
      fbApi.setOptions({ pageID: pageId.toString() });
      console.log('[SENDING] As Fanpage [ID: ' + pageId + '] to Recipient [ID: ' + recipientId + ']');
    } else {
      fbApi.setOptions({ pageID: '' });
      console.log('[SENDING] As Personal Account to [ID: ' + recipientId + ']');
    }

    fbApi.sendMessage(message, recipientId.toString(), (err, info) => {
      if (err) {
        console.error('[ERROR] Send message failed:', err);
        return res.status(500).json({ success: false, error: err });
      }

      console.log('[SUCCESS] Message sent to ' + recipientId + ' | Content: "' + message + '"');
      return res.json({
        success: true,
        recipientId,
        messageInfo: info,
        sentAsPage: Boolean(pageId)
      });
    });
  } catch (err) {
    console.error('[EXCEPTION] Exception while sending message:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('\n======================================================');
  console.log('[READY] FB Fallback Gateway UI running at: http://localhost:' + PORT);
  console.log('======================================================\n');
  initFacebook();
});
