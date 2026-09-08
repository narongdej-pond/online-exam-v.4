
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
          .then((reg) => console.log('Service worker registered.', reg))
          .catch((err) => console.log('Service worker not registered.', err));
      });
    }
  

      let loadingTimer = null;
      let isAlternate = false;

      function startLoading() {
        const loadingEl = document.getElementById('loading');
        const textEl = document.getElementById('loadingText');
        
        loadingEl.classList.remove('hidden');
        textEl.innerText = "กำลังโหลด...";
        textEl.className = "text-gray-600 text-lg transition-all duration-300";
        isAlternate = false;

        if (loadingTimer) clearInterval(loadingTimer);

        loadingTimer = setInterval(() => {
          isAlternate = !isAlternate;

          if (isAlternate) {
            textEl.innerText = "รอคนเก่านานกว่านี้ยังรอได้เลย...รอแค่นี้ไม่ได้หรอ";
            textEl.className = "text-red-600 text-lg font-bold transition-all duration-300";
          } else {
            textEl.innerText = "กำลังโหลด...";
            textEl.className = "text-gray-600 text-lg transition-all duration-300";
          }
        }, 2000);
      }

      function stopLoading() {
        if (loadingTimer) clearInterval(loadingTimer);
        document.getElementById('loading').classList.add('hidden');
      }
    

    const GAS_URL = 'https://script.google.com/macros/s/AKfycbwod0HL8fzn7lzmV2o9pVfJ870wtxXwPBXFCS3WwNq9rGCWfj22dlul12KEEFz8A7nF/exec'; 

    let appData = [];
    let currentUser = null;
    let adminAuthToken = sessionStorage.getItem('dm_exam_admin_token') || '';
    let currentStudentSessionToken = sessionStorage.getItem('dm_exam_student_token') || '';
    let currentExam = null;
    let isInAppBrowserDetected = false;

    function detectInAppBrowser() {
      const ua = navigator.userAgent || navigator.vendor || window.opera || '';

      // LINE Auto-breakout trick: if opened inside LINE, appending openExternalBrowser=1 breaks out on both iOS/Android
      if (/Line\//i.test(ua) && !window.location.search.includes('openExternalBrowser=1')) {
        const sep = window.location.href.includes('?') ? '&' : '?';
        window.location.replace(window.location.href + sep + 'openExternalBrowser=1');
        return true;
      }

      // Check common In-App Browser User-Agent patterns
      const inAppPatterns = [
        /Line\//i,
        /FBAN/i,
        /FBAV/i,
        /FB_IAB/i,
        /FB4A/i,
        /Instagram/i,
        /Twitter/i,
        /musical_ly/i,
        /TikTok/i,
        /ByteLocale/i,
        /BytedanceWebview/i,
        /MicroMessenger/i,
        /Snapchat/i,
        /Pinterest/i,
        /LinkedInApp/i,
        /KAKAOTALK/i,
        /Viber/i,
        /wv\b/i,
        /WebView/i
      ];

      const isIAB = inAppPatterns.some(pattern => pattern.test(ua));
      if (isIAB) {
        isInAppBrowserDetected = true;
        const overlay = document.getElementById('in-app-browser-overlay');
        if (overlay) {
          overlay.classList.remove('hidden');
        }
        return true;
      }
      return false;
    }

    function openInChromeAndroid() {
      const currentUrl = window.location.href.replace(/([?&])openExternalBrowser=1/g, '');
      const cleanUrl = currentUrl.replace(/^https?:\/\//i, '');
      // Android Intent for Google Chrome
      const intentUrl = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
      window.location.href = intentUrl;
    }

    function copyExamPortalLink() {
      const cleanUrl = window.location.href.replace(/([?&])openExternalBrowser=1/g, '');
      const dummyInput = document.createElement('input');
      dummyInput.setAttribute('value', cleanUrl);
      document.body.appendChild(dummyInput);
      dummyInput.select();
      dummyInput.setSelectionRange(0, 99999);
      try {
        document.execCommand('copy');
        const feedback = document.getElementById('copy-feedback');
        if (feedback) {
          feedback.classList.remove('hidden');
          setTimeout(() => feedback.classList.add('hidden'), 5000);
        }
      } catch (err) {
        prompt('กรุณาคัดลอกลิงก์ด้านล่างเพื่อนำไปเปิดใน Safari หรือ Google Chrome:', cleanUrl);
      }
      document.body.removeChild(dummyInput);
    }

    let currentQuestionIndex = 0;
    let examTimer = null;
    let examTimeLeft = 0;
    let studentAnswers = { mc: {}, essay: {} };
    let warningCount = 0;
    let parsedMCQuestions = [];
    let parsedEssayQuestions = [];
    let currentGradingResult = null;
    let activityLogs = [];
    let isExamBlurred = false;
    let lastFocusLossTime = 0;
    let proctoringInterval = null;
    let studentSyncInterval = null;
    let seenMessageIds = new Set();
    let clientPublicIp = 'กำลังตรวจจับ...';
    let clientLocalIp = 'กำลังตรวจจับ...';
    let watermarkTimer = null;
    let isStudentSyncing = false;
    let isStudentDisqualified = false;

    function parseAndFormatThaiDateTime(rawDate) {
      if (!rawDate) {
        const now = new Date();
        return {
          date: now.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }),
          time: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.'
        };
      }

      if (typeof rawDate === 'object' && rawDate.date && rawDate.time) {
        return parseAndFormatThaiDateTime((rawDate.date || '') + ' ' + (rawDate.time || ''));
      }

      let d = null;
      if (rawDate instanceof Date) {
        d = new Date(rawDate.getTime());
      } else if (typeof rawDate === 'number') {
        d = new Date(rawDate);
      } else if (typeof rawDate === 'string') {
        let str = rawDate.trim();
        // แก้ไขกรณีเคยถูกบันทึกปีเป็น 3112 จากการบวกซ้ำ
        str = str.replace(/\b3112\b/g, '2569');

        // แมปเดือนภาษาไทย
        const thaiMonthMap = {
          'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3, 'พ.ค.': 4, 'มิ.ย.': 5,
          'ก.ค.': 6, 'ส.ค.': 7, 'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11,
          'มกราคม': 0, 'กุมภาพันธ์': 1, 'มีนาคม': 2, 'เมษายน': 3, 'พฤษภาคม': 4, 'มิถุนายน': 5,
          'กรกฎาคม': 6, 'สิงหาคม': 7, 'กันยายน': 8, 'ตุลาคม': 9, 'พฤศจิกายน': 10, 'ธันวาคม': 11
        };

        const thaiTextMatch = str.match(/^(\d{1,2})\s+([^\s\d]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
        if (thaiTextMatch && thaiMonthMap[thaiTextMatch[2]] !== undefined) {
          let day = parseInt(thaiTextMatch[1], 10);
          let month = thaiMonthMap[thaiTextMatch[2]];
          let year = parseInt(thaiTextMatch[3], 10);
          if (year > 2400) year -= 543;
          let h = parseInt(thaiTextMatch[4] || '0', 10);
          let m = parseInt(thaiTextMatch[5] || '0', 10);
          let s = parseInt(thaiTextMatch[6] || '0', 10);
          d = new Date(year, month, day, h, m, s);
        } else {
          const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s*,?\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
          if (slashMatch) {
            let day = parseInt(slashMatch[1], 10);
            let month = parseInt(slashMatch[2], 10) - 1;
            let year = parseInt(slashMatch[3], 10);
            if (year > 2400) year -= 543;
            let h = parseInt(slashMatch[4] || '0', 10);
            let m = parseInt(slashMatch[5] || '0', 10);
            let s = parseInt(slashMatch[6] || '0', 10);
            d = new Date(year, month, day, h, m, s);
          } else {
            d = new Date(str);
          }
        }
      }

      if (!d || isNaN(d.getTime())) {
        const now = new Date();
        return {
          date: now.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }),
          time: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.'
        };
      }

      // ป้องกันการบวก พ.ศ. ซ้ำ (หากปีใน d มากกว่า 2400 ให้ลบ 543 กลับมาเป็น ค.ศ. ก่อนแปลงเป็น พ.ศ.)
      while (d.getFullYear() > 2400) {
        d.setFullYear(d.getFullYear() - 543);
      }

      return {
        date: d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.'
      };
    }

    async function fetchNetworkIPs() {
      // 1. ตรวจจับ IP อินเทอร์เน็ต (Public WAN IP)
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        if (data && data.ip) {
          clientPublicIp = data.ip;
        }
      } catch (err) {
        try {
          const res2 = await fetch('https://api64.ipify.org?format=json');
          const data2 = await res2.json();
          if (data2 && data2.ip) {
            clientPublicIp = data2.ip;
          }
        } catch (e) {
          clientPublicIp = 'ไม่พบ IP เน็ต';
        }
      }

      // 2. ตรวจจับ IP ของเครื่อง (Local LAN IP ผ่าน WebRTC Candidate)
      try {
        const RTCPC = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
        if (RTCPC) {
          const pc = new RTCPC({ iceServers: [] });
          pc.createDataChannel('');
          pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(() => {});
          pc.onicecandidate = (event) => {
            if (!event || !event.candidate) return;
            const candidateStr = event.candidate.candidate;
            const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
            const match = ipRegex.exec(candidateStr);
            if (match && match[1] && !match[1].startsWith('0.') && !match[1].startsWith('127.')) {
              clientLocalIp = match[1];
              try { pc.close(); } catch(e){}
            } else {
              const mdnsMatch = /([a-zA-Z0-9-]+)\.local/.exec(candidateStr);
              if (mdnsMatch && clientLocalIp.includes('กำลังตรวจจับ')) {
                // หากถูกเบราว์เซอร์ซ่อนด้วย mDNS UUID ยาวๆ ให้ย่อเฉพาะรหัสช่วงหน้า 8 หลัก เพื่อให้กะทัดรัดและสวยงาม
                const shortId = mdnsMatch[1].split('-')[0];
                clientLocalIp = `${shortId}.local`;
              }
            }
          };
          setTimeout(() => {
            try { pc.close(); } catch(e) {}
            if (clientLocalIp.includes('กำลังตรวจจับ')) {
              clientLocalIp = '127.0.0.1 (Local)';
            }
          }, 2000);
        } else {
          clientLocalIp = '127.0.0.1 (Local)';
        }
      } catch(err) {
        clientLocalIp = '127.0.0.1 (Local)';
      }
    }

    function showActionConfirm({ title = 'ยืนยันการดำเนินการ', message, icon = 'fa-exclamation-triangle', iconColor = 'text-red-500', iconBg = 'bg-red-100', confirmText = 'ยืนยัน', confirmClass = 'bg-red-600 hover:bg-red-700 text-white', onConfirm }) {
      const modalTitle = document.getElementById('confirm-modal-title');
      const modalMsg = document.getElementById('delete-message');
      const iconContainer = document.getElementById('confirm-modal-icon-container');
      const iconEl = document.getElementById('confirm-modal-icon');
      const confirmBtn = document.getElementById('confirm-delete-btn');

      if (modalTitle) modalTitle.textContent = title;
      if (modalMsg) modalMsg.innerHTML = message;
      if (iconContainer) iconContainer.className = `w-16 h-16 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-4`;
      if (iconEl) iconEl.className = `fas ${icon} text-3xl ${iconColor}`;

      if (confirmBtn) {
        confirmBtn.className = `flex-1 font-bold py-3 px-4 rounded-xl transition shadow ${confirmClass}`;
        confirmBtn.textContent = confirmText;
        confirmBtn.onclick = async () => {
          hideModal('confirm-delete-modal');
          if (onConfirm) await onConfirm();
        };
      }
      showModal('confirm-delete-modal');
    }

    function showConfirmDelete(message, callback) {
      showActionConfirm({
        title: 'ยืนยันการลบ',
        message: message,
        icon: 'fa-trash-can',
        iconColor: 'text-red-500',
        iconBg: 'bg-red-100',
        confirmText: 'ลบข้อมูล',
        confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
        onConfirm: callback
      });
    }

    function setButtonLoading(btn, isLoading, loadingText = "กำลังดำเนินการ...", defaultHtml = null) {
      if (!btn) return;
      if (isLoading) {
        if (!btn.dataset.defaultHtml) {
          btn.dataset.defaultHtml = defaultHtml || btn.innerHTML;
        }
        btn.disabled = true;
        btn.classList.add('opacity-80', 'cursor-not-allowed');
        btn.innerHTML = `<i class="fas fa-spinner spin mr-1.5"></i> ${loadingText}`;
      } else {
        btn.disabled = false;
        btn.classList.remove('opacity-80', 'cursor-not-allowed');
        if (btn.dataset.defaultHtml) {
          btn.innerHTML = btn.dataset.defaultHtml;
        }
      }
    }

    function syncActivityLogs() {
      try {
        let storedLogs = [];
        const localData = localStorage.getItem('donmueang_exam_logs');
        if (localData) {
          try {
            const rawStored = JSON.parse(localData);
            // ตรวจสอบและแปลงปี พ.ศ. ของข้อมูลเดิมในแคชให้ถูกต้องอัตโนมัติ
            storedLogs = (Array.isArray(rawStored) ? rawStored : []).map(item => {
              const dt = parseAndFormatThaiDateTime(item.rawTimestamp || (item.date + ' ' + (item.time || '')));
              return {
                ...item,
                date: dt.date,
                time: dt.time
              };
            });
          } catch (e) {
            storedLogs = [];
          }
        }

        const dbLogs = (appData || [])
          .filter(d => d.type === 'log')
          .map(l => {
            const rawTime = l.timestamp || l.created_at || null;
            const dt = parseAndFormatThaiDateTime(rawTime);
            return {
              message: l.action || l.note || 'กิจกรรมระบบ',
              date: dt.date,
              time: dt.time,
              rawTimestamp: rawTime ? new Date(rawTime).getTime() : 0
            };
          });

        const combined = [...activityLogs, ...storedLogs, ...dbLogs];
        const uniqueMap = new Map();

        combined.forEach(item => {
          if (!item || !item.message) return;
          const dt = parseAndFormatThaiDateTime(item.rawTimestamp || (item.date + ' ' + (item.time || '')));
          item.date = dt.date;
          item.time = dt.time;
          const key = `${item.message}_${item.date}_${item.time}`;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, item);
          }
        });

        const sorted = Array.from(uniqueMap.values()).sort((a, b) => {
          const timeA = a.rawTimestamp ? new Date(a.rawTimestamp).getTime() : 0;
          const timeB = b.rawTimestamp ? new Date(b.rawTimestamp).getTime() : 0;
          return timeB - timeA;
        });

        activityLogs = sorted.slice(0, 15);
        localStorage.setItem('donmueang_exam_logs', JSON.stringify(activityLogs));
      } catch (err) {
        console.warn('Error syncing activity logs:', err);
      }
    }

    function renderActivityLogs() {
      const recentEl = document.getElementById('recent-activity');
      if (!recentEl) return;

      if (activityLogs.length > 0) {
        recentEl.innerHTML = activityLogs.map(log => `
          <div class="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100/80 rounded-xl transition fade-in border border-gray-100">
            <div class="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
              <i class="fas fa-history text-primary-600"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-gray-800 text-sm truncate">${log.message}</p>
              <div class="flex items-center gap-3 mt-1 text-xs text-gray-500">
                <span class="inline-flex items-center gap-1 font-semibold text-gray-600"><i class="far fa-calendar-alt text-primary-500"></i>${log.date || '-'}</span>
                <span class="inline-flex items-center gap-1 font-semibold text-gray-600"><i class="far fa-clock text-primary-500"></i>${log.time || '-'}</span>
              </div>
            </div>
          </div>
        `).join('');
      } else {
        recentEl.innerHTML = '<p class="text-gray-500 text-center py-4">ยังไม่มีกิจกรรม</p>';
      }
    }

    function logActivity(message) {
      const now = new Date();
      const dt = parseAndFormatThaiDateTime(now);
      const newLog = { 
        message, 
        date: dt.date, 
        time: dt.time,
        rawTimestamp: now.toISOString()
      };
      activityLogs.unshift(newLog);
      if (activityLogs.length > 15) activityLogs.pop();
      try {
        localStorage.setItem('donmueang_exam_logs', JSON.stringify(activityLogs));
      } catch(e) {}
      renderActivityLogs();

      if (window.dataSdk && window.dataSdk.create) {
        window.dataSdk.create({
          id: generateId(),
          type: 'log',
          member_id: currentUser ? (currentUser.id || currentUser.__backendId || '') : '',
          username: currentUser ? currentUser.username : 'Guest',
          action: message,
          status: 'success',
          note: message,
          timestamp: now.toISOString()
        }).catch(err => console.warn('Database log record notice:', err));
      }
    }

    window.dataSdk = {
        _callAPI: async function(action, payload = null) {
            try {
                const response = await fetch(GAS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: action, payload: payload, token: adminAuthToken || currentStudentSessionToken || '' })
                });
                const result = await response.json();
                if (result.status === 'success') {
                    return result.data;
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                console.error("API Error:", error);
                throw error;
            }
        },
        create: async function(item) {
            try {
                const savedItem = await this._callAPI('createData', item);
                appData.push(savedItem);
                updateUI();
                return { isOk: true, data: savedItem };
            } catch (err) {
                return { isOk: false, error: err };
            }
        },
        update: async function(item) {
            try {
                const updatedItem = await this._callAPI('updateData', item);
                const index = appData.findIndex(d => d.id === updatedItem.id || d.__backendId === updatedItem.__backendId);
                if (index !== -1) appData[index] = updatedItem;
                updateUI();
                return { isOk: true, data: updatedItem };
            } catch (err) {
                return { isOk: false, error: err };
            }
        },
        delete: async function(item) {
            try {
                const success = await this._callAPI('deleteData', item);
                if (success) {
                    appData = appData.filter(d => d.id !== item.id && d.__backendId !== item.__backendId);
                    updateUI();
                    return { isOk: true };
                }
                return { isOk: false };
            } catch (err) {
                return { isOk: false, error: err };
            }
        },
        startStudent: async function(item) {
            try {
                const data = await this._callAPI('startStudent', item);
                return { isOk: true, data: data };
            } catch (err) {
                return { isOk: false, error: err };
            }
        },
        syncStudent: async function(payload) {
            return this._callAPI('studentSync', payload);
        },
        reportWarning: async function(payload) {
            return this._callAPI('reportWarning', payload);
        },
        submitExam: async function(payload) {
            try {
                const data = await this._callAPI('submitExam', payload);
                return { isOk: true, data: data };
            } catch (err) {
                return { isOk: false, error: err };
            }
        },
        updateProfile: async function(payload) {
            try {
                const data = await this._callAPI('updateProfile', payload);
                return { isOk: true, data: data };
            } catch (err) {
                return { isOk: false, error: err };
            }
        }
    };

    async function initApp() {
      detectInAppBrowser();
      startLoading();
      fetchNetworkIPs();
      try {
          const data = await window.dataSdk._callAPI('getData');
          appData = data || [];
      } catch (err) {
          console.warn("Failed to load data from GAS:", err);
          appData = [];
      } finally {
          stopLoading();
          showPage('home');
          updateUI();
          setupPasswordHoldToReveal();
      }
    }

    function setupPasswordHoldToReveal() {
      const toggleButtons = document.querySelectorAll('.password-toggle-btn');
      
      toggleButtons.forEach(btn => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        const icon = btn.querySelector('i');
        if (!input || !icon) return;

        const showPass = (e) => {
          e.preventDefault();
          input.type = 'text';
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
        };

        const hidePass = (e) => {
          e.preventDefault();
          input.type = 'password';
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
        };

        btn.addEventListener('mousedown', showPass);
        btn.addEventListener('mouseup', hidePass);
        btn.addEventListener('mouseleave', hidePass);
        btn.addEventListener('touchstart', showPass, { passive: false });
        btn.addEventListener('touchend', hidePass);
        btn.addEventListener('touchcancel', hidePass);
      });
    }

    function showPage(page) {
      document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
      const target = document.getElementById(`page-${page}`);
      if (target) target.classList.remove('hidden');
    }

    function goHome() {
      resetExamState();
      showPage('home');
    }

    function showModal(id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('hidden');
    }

    function hideModal(id) {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    }

    function showAlert(type, title, message) {
      const iconEl = document.getElementById('alert-icon');
      const titleEl = document.getElementById('alert-title');
      const messageEl = document.getElementById('alert-message');
      
      if (type === 'success') {
        iconEl.className = 'w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4';
        iconEl.innerHTML = '<i class="fas fa-check text-3xl text-green-500"></i>';
      } else if (type === 'error') {
        iconEl.className = 'w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4';
        iconEl.innerHTML = '<i class="fas fa-times text-3xl text-red-500"></i>';
      } else if (type === 'warning') {
        iconEl.className = 'w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4';
        iconEl.innerHTML = '<i class="fas fa-exclamation text-3xl text-yellow-500"></i>';
      } else {
        iconEl.className = 'w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4';
        iconEl.innerHTML = '<i class="fas fa-info text-3xl text-blue-500"></i>';
      }
      
      titleEl.textContent = title;
      messageEl.textContent = message;
      showModal('alert-modal');
    }

    function getMembers() {
      return appData.filter(d => d.type === 'member');
    }

    function getExams() {
      const isMainAdmin = currentUser && getMembers().find(m => m.role === 'admin' && m.__backendId === currentUser.__backendId);
      if (isMainAdmin) {
        return appData.filter(d => d.type === 'exam');
      }
      return appData.filter(d => d.type === 'exam' && d.member_id === currentUser?.__backendId);
    }

    function getStudents() {
      if (!currentUser) return [];
      const isMainAdmin = currentUser.role === 'admin';
      if (isMainAdmin) {
        return appData.filter(d => d.type === 'student');
      }
      const teacherExamIds = getExams().map(e => e.id);
      return appData.filter(d => d.type === 'student' && teacherExamIds.includes(d.subject_id));
    }

    function getResults() {
      if (!currentUser) return [];
      const isMainAdmin = currentUser.role === 'admin';
      if (isMainAdmin) {
        return appData.filter(d => d.type === 'result');
      }
      const teacherExamIds = getExams().map(e => e.id);
      return appData.filter(d => d.type === 'result' && teacherExamIds.includes(d.subject_id));
    }

    function getAnnouncements() {
      return appData.filter(d => d.type === 'announcement');
    }

    function generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }

    function updateUI() {
      updateSubjectSelect();
      updateHomeAnnouncements();
      if (currentUser) {
        updateDashboard();
        updateAnnouncementsTable();
        updateProctorSubjectSelect();
        updateMembersTable();
        updateExamsTable();
        updateStudentsTable();
        updateResultsTable();
        updateGradingTable();
        updateTimeSettings();
      }
    }

    function updateHomeAnnouncements() {
      const container = document.getElementById('home-announcements-container');
      const list = document.getElementById('home-announcements-list');
      if (!container || !list) return;

      const activeAnnouncements = getAnnouncements().filter(a => a.is_active);
      if (activeAnnouncements.length === 0) {
        container.classList.add('hidden');
        list.innerHTML = '';
        return;
      }

      container.classList.remove('hidden');
      list.innerHTML = activeAnnouncements.map(a => {
        let badgeColor = 'bg-blue-400 text-blue-950';
        let badgeIcon = 'fa-info-circle';
        let badgeText = 'ทั่วไป';
        if (a.level === 'warning') {
          badgeColor = 'bg-yellow-400 text-yellow-950';
          badgeIcon = 'fa-triangle-exclamation';
          badgeText = 'สำคัญ';
        } else if (a.level === 'urgent') {
          badgeColor = 'bg-red-400 text-red-950';
          badgeIcon = 'fa-circle-exclamation';
          badgeText = 'ด่วนที่สุด';
        }

        return `
          <div class="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/20">
           <div class="flex items-center justify-between mb-1.5">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeColor}">
             <i class="fas ${badgeIcon}"></i> ${badgeText}
            </span>
            <span class="text-xs text-blue-100">${new Date(a.created_at).toLocaleDateString('th-TH')}</span>
           </div>
           <h4 class="font-bold text-white text-base">${a.title}</h4>
           <p class="text-xs text-blue-100 mt-1 whitespace-pre-wrap leading-relaxed">${a.content}</p>
          </div>
        `;
      }).join('');
    }

    function updateAnnouncementsTable() {
      const tbody = document.getElementById('announcements-table');
      if (!tbody) return;
      const announcements = getAnnouncements();

      if (announcements.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">ไม่พบประกาศข่าวสาร</td></tr>';
        return;
      }

      const isAdmin = currentUser && currentUser.role === 'admin';
      tbody.innerHTML = announcements.map((a, i) => {
        let levelBadge = '<span class="badge badge-info">ทั่วไป</span>';
        if (a.level === 'warning') levelBadge = '<span class="badge badge-warning">สำคัญ</span>';
        if (a.level === 'urgent') levelBadge = '<span class="badge badge-danger">ด่วนที่สุด</span>';

        return `
          <tr class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm">${i + 1}</td>
            <td class="px-4 py-3 text-sm font-medium text-gray-800">
             <div>${a.title}</div>
             <div class="text-xs text-gray-500 truncate max-w-xs">${a.content}</div>
            </td>
            <td class="px-4 py-3 text-sm">${levelBadge}</td>
            <td class="px-4 py-3 text-sm text-gray-500">${new Date(a.created_at).toLocaleDateString('th-TH')}</td>
            <td class="px-4 py-3">
              <span class="badge ${a.is_active ? 'badge-success' : 'badge-danger'}">
                ${a.is_active ? 'แสดงผล' : 'ปิดซ่อน'}
              </span>
            </td>
            <td class="px-4 py-3 text-center">
              ${isAdmin ? `
                <button onclick="editAnnouncement('${a.__backendId}')" class="text-primary-600 hover:text-primary-800 mx-1 font-medium text-xs px-2 py-1 rounded bg-blue-50">
                  <i class="fas fa-edit mr-1"></i>แก้ไข
                </button>
                <button onclick="toggleAnnouncementActive('${a.__backendId}')" class="text-yellow-600 hover:text-yellow-800 mx-1 font-medium text-xs px-2 py-1 rounded bg-yellow-50">
                  <i class="fas fa-${a.is_active ? 'eye-slash' : 'eye'} mr-1"></i>${a.is_active ? 'ซ่อน' : 'แสดง'}
                </button>
                <button onclick="deleteAnnouncement('${a.__backendId}')" class="text-red-500 hover:text-red-700 mx-1 font-medium text-xs px-2 py-1 rounded bg-red-50">
                  <i class="fas fa-trash mr-1"></i>ลบ
                </button>
              ` : `<span class="text-xs text-gray-400">เฉพาะ Admin</span>`}
            </td>
          </tr>
        `;
      }).join('');
    }

    function openAddAnnouncementModal() {
      if (!currentUser || currentUser.role !== 'admin') {
        showAlert('warning', 'ไม่มีสิทธิ์การใช้งาน', 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถสร้างประกาศได้');
        return;
      }
      document.getElementById('announcement-edit-id').value = '';
      document.getElementById('announcement-title').value = '';
      document.getElementById('announcement-level').value = 'info';
      document.getElementById('announcement-content').value = '';
      document.getElementById('announcement-active').checked = true;
      document.getElementById('announcement-modal-title').textContent = 'เพิ่มประกาศใหม่';
      showModal('announcement-modal');
    }

    function editAnnouncement(backendId) {
      if (!currentUser || currentUser.role !== 'admin') {
        showAlert('warning', 'ไม่มีสิทธิ์การใช้งาน', 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถแก้ไขประกาศได้');
        return;
      }
      const item = appData.find(d => d.__backendId === backendId);
      if (!item) return;

      showActionConfirm({
        title: 'ยืนยันการแก้ไขประกาศ',
        message: `คุณต้องการเปิดแก้ไขประกาศหัวข้อ "${item.title}" ใช่หรือไม่?`,
        icon: 'fa-pen-to-square',
        iconColor: 'text-primary-600',
        iconBg: 'bg-primary-100',
        confirmText: 'เปิดแก้ไข',
        confirmClass: 'bg-primary-600 hover:bg-primary-700 text-white',
        onConfirm: () => {
          document.getElementById('announcement-edit-id').value = backendId;
          document.getElementById('announcement-title').value = item.title;
          document.getElementById('announcement-level').value = item.level || 'info';
          document.getElementById('announcement-content').value = item.content;
          document.getElementById('announcement-active').checked = item.is_active;
          document.getElementById('announcement-modal-title').textContent = 'แก้ไขประกาศ';
          showModal('announcement-modal');
        }
      });
    }

    async function toggleAnnouncementActive(backendId) {
      if (!currentUser || currentUser.role !== 'admin') {
        showAlert('warning', 'ไม่มีสิทธิ์การใช้งาน', 'เฉพาะผู้ดูแลระบบหลักเท่านั้น');
        return;
      }
      const item = appData.find(d => d.__backendId === backendId);
      if (!item) return;

      const actionText = item.is_active ? 'ซ่อนการแสดงผล' : 'เปิดแสดงผล';
      showActionConfirm({
        title: `ยืนยันการ${actionText}ประกาศ`,
        message: `คุณต้องการ${actionText}ประกาศหัวข้อ "${item.title}" บนหน้าแรกใช่หรือไม่?`,
        icon: item.is_active ? 'fa-eye-slash' : 'fa-eye',
        iconColor: item.is_active ? 'text-amber-600' : 'text-emerald-600',
        iconBg: item.is_active ? 'bg-amber-100' : 'bg-emerald-100',
        confirmText: `ยืนยัน${actionText}`,
        confirmClass: item.is_active ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white',
        onConfirm: async () => {
          const res = await window.dataSdk.update({ ...item, is_active: !item.is_active });
          if (res.isOk) {
            logActivity(`${actionText}ประกาศ: ${item.title}`);
            showAlert('success', 'สำเร็จ', item.is_active ? `ซ่อนประกาศ "${item.title}" เรียบร้อยแล้ว` : `เปิดแสดงผลประกาศ "${item.title}" เรียบร้อยแล้ว`);
          }
        }
      });
    }

    function deleteAnnouncement(backendId) {
      if (!currentUser || currentUser.role !== 'admin') {
        showAlert('warning', 'ไม่มีสิทธิ์การใช้งาน', 'เฉพาะผู้ดูแลระบบหลักเท่านั้น');
        return;
      }
      const item = appData.find(d => d.__backendId === backendId);
      if (!item) return;

      showConfirmDelete(`คุณต้องการลบประกาศข่าวสารหัวข้อ "${item.title}" นี้ใช่หรือไม่?`, async () => {
        const res = await window.dataSdk.delete(item);
        if (res.isOk) {
          logActivity(`ลบประกาศ: ${item.title}`);
          showAlert('success', 'สำเร็จ', `ลบประกาศ "${item.title}" เรียบร้อยแล้ว`);
        }
      });
    }

    function updateProctorSubjectSelect() {
      const select = document.getElementById('proctor-subject-select');
      if (!select) return;
      const exams = getExams();
      const currentVal = select.value;

      select.innerHTML = '<option value="">-- เลือกรายวิชาเพื่อคุมสอบ --</option>';
      exams.forEach(exam => {
        select.innerHTML += `<option value="${exam.id}">${exam.subject_name}</option>`;
      });

      if (currentVal && exams.some(e => e.id === currentVal)) {
        select.value = currentVal;
      }
    }

    function changeProctorSubject() {
      renderProctoringLive();
    }

    function refreshProctoringLive() {
      renderProctoringLive();
      showAlert('info', 'อัปเดตข้อมูลคุมสอบ', 'ดึงข้อมูลสถานะผู้สอบล่าสุดแล้ว');
    }

    function renderProctoringLive() {
      const subjectId = document.getElementById('proctor-subject-select').value;
      const tbody = document.getElementById('proctor-students-table');
      const subjectLabel = document.getElementById('proctor-current-subject-label');
      
      if (!subjectId) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-12 text-center text-gray-400">กรุณาเลือกรายวิชาเพื่อเริ่มคุมสอบ</td></tr>';
        if (subjectLabel) subjectLabel.textContent = 'ยังไม่ได้เลือกรายวิชา';
        document.getElementById('proctor-stat-active').textContent = '0';
        document.getElementById('proctor-stat-warned').textContent = '0';
        document.getElementById('proctor-stat-submitted').textContent = '0';
        document.getElementById('proctor-stat-disqualified').textContent = '0';
        return;
      }

      const exam = appData.find(e => e.id === subjectId && e.type === 'exam');
      if (subjectLabel) subjectLabel.textContent = exam ? `วิชา: ${exam.subject_name}` : 'กำลังคุมสอบ';

      const students = appData.filter(d => d.type === 'student' && String(d.subject_id) === String(subjectId));
      const results = appData.filter(d => d.type === 'result' && String(d.subject_id) === String(subjectId));

      let countActive = 0;
      let countWarned = 0;
      let countSubmitted = 0;
      let countDisqualified = 0;

      if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-500">ยังไม่มีนักเรียนลงชื่อเข้าสอบวิชานี้</td></tr>';
      } else {
        tbody.innerHTML = students.map((s, idx) => {
          const result = results.find(r => String(r.student_id) === String(s.student_id));
          const warnings = s.warnings || (result ? result.warnings : 0) || 0;
          const isSubmitted = !!result;
          const isDisqualified = s.is_disqualified || (result && (result.cheating_detected || result.warnings >= 4));

          if (isDisqualified) {
            countDisqualified++;
          } else if (isSubmitted) {
            countSubmitted++;
          } else {
            countActive++;
            if (warnings > 0) countWarned++;
          }

          let statusBadge = '<span class="badge badge-info"><i class="fas fa-spinner spin mr-1"></i> กำลังสอบ</span>';
          if (isDisqualified) {
            statusBadge = '<span class="badge badge-danger"><i class="fas fa-ban mr-1"></i> ทุจริต/ถูกตัดสิทธิ์</span>';
          } else if (isSubmitted) {
            statusBadge = `<span class="badge badge-success"><i class="fas fa-check mr-1"></i> ส่งแล้ว (${result.score}/${result.total_score})</span>`;
          } else if (warnings >= 3) {
            statusBadge = '<span class="badge badge-danger animate-pulse"><i class="fas fa-triangle-exclamation mr-1"></i> วิกฤตเตือน 3 ครั้ง</span>';
          } else if (warnings > 0) {
            statusBadge = '<span class="badge badge-warning"><i class="fas fa-eye-slash mr-1"></i> หลุดโฟกัส</span>';
          }

          return `
            <tr class="hover:bg-blue-50/50 transition">
             <td class="px-4 py-3 text-sm text-gray-600">${idx + 1}</td>
             <td class="px-4 py-3 text-sm">
              <div class="font-bold text-gray-800">${s.fullname}</div>
              <div class="text-xs text-gray-600 font-semibold font-sarabun">${s.student_id}</div>
             </td>
             <td class="px-4 py-3 text-sm text-gray-700 font-medium">
              ${s.class_name}/${s.room} <span class="text-gray-400">#${s.number}</span>
             </td>
             <td class="px-4 py-3 text-xs text-gray-500">
              ${s.started_at ? new Date(s.started_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'}
             </td>
             <td class="px-4 py-3 text-sm">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${warnings >= 3 ? 'bg-red-100 text-red-700' : (warnings > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600')}">
               ${warnings}/3 ครั้ง
              </span>
             </td>
             <td class="px-4 py-3">${statusBadge}</td>
             <td class="px-4 py-3 text-center">
              <div class="flex items-center justify-center gap-1.5">
               <button onclick="openDirectProctorMessageModal('${s.student_id}', '${s.fullname}', '${subjectId}')" ${isSubmitted || isDisqualified ? 'disabled' : ''} class="bg-primary-600 hover:bg-primary-700 disabled:opacity-30 disabled:cursor-not-allowed text-white px-2.5 py-1 rounded-lg text-xs font-medium shadow-sm transition" title="ส่งข้อความเตือนรายบุคคล">
                <i class="fas fa-paper-plane mr-1"></i>เตือน
               </button>
               <button onclick="proctorDisqualifyStudent('${s.student_id}', '${s.fullname}', '${subjectId}')" ${isSubmitted || isDisqualified ? 'disabled' : ''} class="bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-white px-2.5 py-1 rounded-lg text-xs font-medium shadow-sm transition" title="ตัดสิทธิ์การสอบทันที">
                <i class="fas fa-ban mr-1"></i>ตัดสิทธิ์
               </button>
              </div>
             </td>
            </tr>
          `;
        }).join('');
      }

      document.getElementById('proctor-stat-active').textContent = countActive;
      document.getElementById('proctor-stat-warned').textContent = countWarned;
      document.getElementById('proctor-stat-submitted').textContent = countSubmitted;
      document.getElementById('proctor-stat-disqualified').textContent = countDisqualified;
    }

    function openDirectProctorMessageModal(studentId, fullname, subjectId) {
      document.getElementById('proctor-msg-target-id').value = studentId;
      document.getElementById('proctor-msg-subject-id').value = subjectId;
      document.getElementById('proctor-msg-target-name').textContent = `${fullname} (รหัส ${studentId})`;
      document.getElementById('proctor-msg-text').value = '';
      showModal('proctor-message-modal');
    }

    function quickFillProctorMsg(text) {
      document.getElementById('proctor-msg-text').value = text;
    }

    function broadcastAlertToAllModal() {
      const subjectId = document.getElementById('proctor-subject-select').value;
      if (!subjectId) {
        showAlert('warning', 'เลือกรายวิชาก่อน', 'กรุณาเลือกรายวิชาที่คุมสอบก่อนส่งแจ้งเตือน');
        return;
      }
      const exam = appData.find(e => e.id === subjectId && e.type === 'exam');
      document.getElementById('broadcast-subject-name-label').textContent = exam ? exam.subject_name : '-';
      document.getElementById('broadcast-msg-text').value = '';
      showModal('broadcast-message-modal');
    }

    function proctorDisqualifyStudent(studentId, fullname, subjectId) {
      const exam = appData.find(e => e.id === subjectId && e.type === 'exam');
      const subjectName = exam ? exam.subject_name : '-';

      showActionConfirm({
        title: 'ยืนยันการตัดสิทธิ์สอบทันที',
        message: `คุณต้องการตัดสิทธิ์การสอบของ "${fullname}" (รหัส ${studentId})\nในวิชา "${subjectName}" ใช่หรือไม่?\n\n(ผู้สอบจะถูกยุติการสอบทันทีและบันทึกสถานะตรวจพบทุจริต)`,
        icon: 'fa-ban',
        iconColor: 'text-red-600',
        iconBg: 'bg-red-100',
        confirmText: 'ตัดสิทธิ์ทันที',
        confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
        onConfirm: async () => {
          const student = appData.find(d => d.type === 'student' && String(d.student_id).trim() === String(studentId).trim() && String(d.subject_id).trim() === String(subjectId).trim());
          if (student) {
            await window.dataSdk.update({ ...student, is_disqualified: true, warnings: 4 });
          }

          const existingResult = appData.find(r => r.type === 'result' && String(r.student_id).trim() === String(studentId).trim() && String(r.subject_id).trim() === String(subjectId).trim());

          if (existingResult) {
            await window.dataSdk.update({
              ...existingResult,
              warnings: 4,
              cheating_detected: true
            });
          } else {
            await window.dataSdk.create({
              id: generateId(),
              type: 'result',
              member_id: exam ? exam.member_id : '',
              student_id: studentId,
              fullname: fullname,
              class_name: student ? student.class_name : '',
              room: student ? student.room : '',
              number: student ? student.number : '',
              subject_id: subjectId,
              subject_name: subjectName,
              answers: JSON.stringify({ mc: {}, essay: {} }),
              mc_score: 0,
              score: 0,
              total_score: exam ? exam.total_score : 100,
              submitted_at: new Date().toISOString(),
              graded: true,
              warnings: 4,
              cheating_detected: true
            });
          }

          // ส่งสัญญาณคำสั่งตัดสิทธิ์ไปยังหน้านักเรียนทันทีแบบเรียลไทม์
          await window.dataSdk.create({
            id: generateId(),
            type: 'proctor_msg',
            target_student_id: studentId,
            subject_id: subjectId,
            action: 'DISQUALIFY',
            message: `ผู้คุมสอบได้สั่งตัดสิทธิ์การสอบของคุณในวิชา "${subjectName}" ทันที เนื่องจากตรวจพบการทุจริตหรือไม่ปฏิบัติตามกฎระเบียบการสอบ`,
            sender_name: currentUser ? currentUser.fullname : 'ผู้คุมสอบ',
            created_at: new Date().toISOString()
          });

          logActivity(`ผู้คุมสอบสั่งตัดสิทธิ์การสอบ ${studentId} (${fullname})`);
          renderProctoringLive();
          showAlert('success', 'ตัดสิทธิ์เรียบร้อย', `ตัดสิทธิ์การสอบของ "${fullname}" เรียบร้อยแล้ว`);
        }
      });
    }

    function playNotificationSound() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      } catch (e) {}
    }

    function startStudentProctorSync(studentId, subjectId) {
      if (studentSyncInterval) clearInterval(studentSyncInterval);
      isStudentSyncing = false;
      
      // บันทึกข้อความที่มีอยู่เดิมไว้ก่อนเข้าสอบ เพื่อไม่ให้แจ้งเตือนข้อความเก่าซ้ำ
      seenMessageIds = new Set(appData.filter(d => d.type === 'proctor_msg').map(m => m.id));

      // ซิงก์ข้อมูลสดทุก 0.5 วินาที (500 ms) แบบ Ultra Real-Time
      studentSyncInterval = setInterval(async () => {
        if (document.getElementById('page-exam').classList.contains('hidden')) {
          clearInterval(studentSyncInterval);
          return;
        }

        // ป้องกันการส่งคำขอซ้ำซ้อนหากรอบก่อนหน้ากำลังดาวน์โหลดข้อมูลอยู่
        if (isStudentSyncing) return;
        isStudentSyncing = true;

        try {
          const freshData = await window.dataSdk._callAPI('studentSync', {
            student_id: studentId,
            subject_id: subjectId,
            session_token: currentStudentSessionToken
          });
          if (freshData && Array.isArray(freshData)) {
            appData = appData.filter(d => !['student','result','proctor_msg'].includes(d.type)).concat(freshData);
          }
        } catch (e) {
          // ละเว้นกรณีมีปัญหาเครือข่ายชั่วคราว
        } finally {
          isStudentSyncing = false;
        }

        // 1. ตรวจสอบสถานะการตัดสิทธิ์สอบจากข้อมูลผู้เรียนหรือผลสอบ
        const studentRecord = appData.find(d => d.type === 'student' && String(d.student_id).trim() === String(studentId).trim() && String(d.subject_id).trim() === String(subjectId).trim());
        const studentResult = appData.find(r => r.type === 'result' && String(r.student_id).trim() === String(studentId).trim() && String(r.subject_id).trim() === String(subjectId).trim());

        if ((studentRecord && studentRecord.is_disqualified) || (studentResult && (studentResult.cheating_detected || studentResult.warnings >= 4))) {
          isStudentDisqualified = true;
          warningCount = 4;
          clearInterval(studentSyncInterval);
          showStudentDisqualificationPopup('ผู้คุมสอบได้สั่งตัดสิทธิ์การสอบของคุณทันที เนื่องจากตรวจพบการกระทำทุจริตหรือไม่ปฏิบัติตามกฎระเบียบการสอบ');
          return;
        }

        // 2. ตรวจสอบข้อความแจ้งเตือนสด ทั้งแบบประกาศทุกคน (ALL) และเตือนรายบุคคล
        const msgs = appData.filter(d => d.type === 'proctor_msg' && 
          String(d.subject_id).trim() === String(subjectId).trim() && 
          (d.target_student_id === 'ALL' || String(d.target_student_id).trim() === String(studentId).trim())
        ).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        for (const msg of msgs) {
          if (!seenMessageIds.has(msg.id)) {
            seenMessageIds.add(msg.id);
            if (msg.action === 'DISQUALIFY') {
              isStudentDisqualified = true;
              warningCount = 4;
              clearInterval(studentSyncInterval);
              showStudentDisqualificationPopup(msg.message);
              return;
            } else {
              const isBroadcast = msg.target_student_id === 'ALL';
              displayStudentProctorAlert(msg.message, isBroadcast, msg.sender_name, msg.created_at);
              break;
            }
          }
        }
      }, 500);
    }

    function displayStudentProctorAlert(message, isBroadcast, senderName, createdAt) {
      const headerBanner = document.getElementById('student-alert-header-banner');
      const iconWrapper = document.getElementById('student-alert-icon-wrapper');
      const icon = document.getElementById('student-alert-icon');
      const title = document.getElementById('student-alert-title');
      const subtitle = document.getElementById('student-alert-subtitle');
      const badge = document.getElementById('student-alert-badge');
      const senderEl = document.getElementById('student-alert-sender');
      const timeEl = document.getElementById('student-alert-timestamp');
      const msgBox = document.getElementById('student-proctor-alert-msg');
      const contentBox = document.getElementById('student-alert-content-box');
      const confirmBtn = document.getElementById('student-alert-confirm-btn');

      if (senderEl) senderEl.textContent = senderName || 'ผู้คุมสอบ';
      if (timeEl) {
        timeEl.textContent = createdAt ? new Date(createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.' : 'เมื่อสักครู่';
      }

      if (isBroadcast) {
        // ธีมประกาศทุกคน: น้ำเงิน Gradient เดียวกับระบบ
        if (headerBanner) headerBanner.className = 'gradient-bg text-black px-6 py-4 flex items-center justify-between shadow-md';
        if (iconWrapper) iconWrapper.className = 'w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-white text-xl shadow-inner shrink-0';
        if (icon) icon.className = 'fas fa-bullhorn text-xl animate-bounce';
        if (title) title.textContent = 'ประกาศแจ้งเตือนทุกคน';
        if (badge) {
          badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-800 backdrop-blur text-white';
          badge.innerHTML = '<i class="fas fa-users mr-1"></i> แจ้งเตือนทุกคน';
        }
        if (contentBox) contentBox.className = 'bg-primary-50/70 border-2 border-primary-200 rounded-xl p-4 my-2 text-slate-800 font-semibold text-base whitespace-pre-wrap leading-relaxed';
        if (confirmBtn) confirmBtn.className = 'w-full gradient-bg text-white font-bold py-3.5 px-6 rounded-xl btn-hover shadow-lg flex items-center justify-center gap-2 text-base transition';
      } else {
        // ธีมเตือนรายบุคคล: สีเหลืองอำพัน-ส้ม เรียบหรูสไตล์การ์ดระบบ
        if (headerBanner) headerBanner.className = 'bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 text-black px-6 py-4 flex items-center justify-between shadow-md';
        if (iconWrapper) iconWrapper.className = 'w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-white text-xl shadow-inner shrink-0';
        if (icon) icon.className = 'fas fa-triangle-exclamation text-xl animate-pulse';
        if (title) title.textContent = 'คำเตือนจากผู้คุมสอบ';
        if (badge) {
          badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-800 backdrop-blur text-white';
          badge.innerHTML = '<i class="fas fa-user-lock mr-1"></i> คำเตือนเฉพาะคุณ';
        }
        if (contentBox) contentBox.className = 'bg-amber-50/80 border-2 border-amber-200 rounded-xl p-4 my-2 text-amber-950 font-semibold text-base whitespace-pre-wrap leading-relaxed';
        if (confirmBtn) confirmBtn.className = 'w-full bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white font-bold py-3.5 px-6 rounded-xl btn-hover shadow-lg flex items-center justify-center gap-2 text-base transition';
      }

      if (msgBox) msgBox.textContent = message;
      unblurExamView();
      playNotificationSound();
      showModal('student-proctor-alert-modal');
    }

    function showStudentDisqualificationPopup(reason) {
      isStudentDisqualified = true;
      warningCount = 4;
      const reasonEl = document.getElementById('student-disqualified-reason');
      if (reasonEl && reason) reasonEl.textContent = reason;
      unblurExamView();
      playNotificationSound();
      showModal('student-disqualified-modal');
    }

    function confirmStudentDisqualification() {
      hideModal('student-disqualified-modal');
      submitExam();
    }

    function dismissStudentProctorAlert() {
      hideModal('student-proctor-alert-modal');
    }

    function updateSubjectSelect() {
      const select = document.getElementById('subject-select');
      const exams = appData.filter(d => d.type === 'exam' && d.is_visible);
      select.innerHTML = '<option value="">เลือกรายวิชา</option>';
      exams.forEach(exam => {
        select.innerHTML += `<option value="${exam.id}">${exam.subject_name}</option>`;
      });
    }

    function updateDashboard() {
      document.getElementById('stat-members').textContent = getMembers().length;
      document.getElementById('stat-exams').textContent = getExams().length;
      document.getElementById('stat-students').textContent = getStudents().length;
      document.getElementById('stat-results').textContent = getResults().length;

      const updateAdminDateTime = () => {
        const now = new Date();
        const options = { 
          weekday: 'short', 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        };
        const dateTimeStr = now.toLocaleDateString('th-TH', options);
        const datetimeEl = document.getElementById('admin-datetime');
        if (datetimeEl) datetimeEl.textContent = dateTimeStr;
      };
      
      updateAdminDateTime();
      
      if (window.adminDatetimeInterval) clearInterval(window.adminDatetimeInterval);
      window.adminDatetimeInterval = setInterval(updateAdminDateTime, 1000);

      const results = getResults();
      const last7Days = [];
      const counts = [0, 0, 0, 0, 0, 0, 0];
      const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
      const dayLabels = [];

      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        last7Days.push(d.toISOString().split('T')[0]);
        dayLabels.push(dayNames[d.getDay()]);
      }

      results.forEach(r => {
        if (r.submitted_at) {
          const submittedDate = new Date(r.submitted_at).toISOString().split('T')[0];
          const index = last7Days.indexOf(submittedDate);
          if (index !== -1) {
            counts[index]++;
          }
        }
      });

      updateCharts(counts, dayLabels);

      syncActivityLogs();
      renderActivityLogs();
    }

    function updateCharts(counts, dayLabels) {
      const dailyCtx = document.getElementById('chart-daily');
      if (dailyCtx && window.Chart) {
        const existingChart = Chart.getChart(dailyCtx);
        if (existingChart) existingChart.destroy();
        
        new Chart(dailyCtx, {
          type: 'line',
          data: {
            labels: dayLabels || ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'],
            datasets: [{
              label: 'จำนวนผู้สอบ',
              data: counts,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              fill: true,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1 }
              }
            }
          }
        });
      }

      const passFailCtx = document.getElementById('chart-pass-fail');
      if (passFailCtx && window.Chart) {
        const existingChart = Chart.getChart(passFailCtx);
        if (existingChart) existingChart.destroy();
        
        const allResults = getResults();
        let passedCount = 0;
        let failedCount = 0;

        allResults.forEach(r => {
          const passThreshold = r.passing_score !== undefined ? r.passing_score : (r.total_score ? (r.total_score / 2) : 50);
          const isCheating = r.cheating_detected || (r.warnings >= 4);
          
          if (!isCheating && (r.score || 0) >= passThreshold) {
            passedCount++;
          } else {
            failedCount++;
          }
        });

        const totalResults = passedCount + failedCount;
        const passPercent = totalResults > 0 ? Math.round((passedCount / totalResults) * 100) : 0;
        const failPercent = totalResults > 0 ? Math.round((failedCount / totalResults) * 100) : 0;

        const badgeEl = document.getElementById('pass-rate-badge');
        if (badgeEl) {
          badgeEl.className = `badge ${passPercent >= 50 ? 'badge-success' : 'badge-danger'}`;
          badgeEl.textContent = `อัตราผ่าน ${passPercent}%`;
        }

        const chartData = totalResults > 0 ? [passedCount, failedCount] : [0, 0];
        const displayData = totalResults > 0 ? chartData : [1];
        const backgroundColors = totalResults > 0 ? ['#10b981', '#ef4444'] : ['#e2e8f0'];
        const labels = totalResults > 0 
          ? [`ผ่านเกณฑ์ (${passedCount} คน - ${passPercent}%)`, `ไม่ผ่านเกณฑ์ (${failedCount} คน - ${failPercent}%)`]
          : ['ยังไม่มีข้อมูลผลสอบ'];

        new Chart(passFailCtx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: displayData,
              backgroundColor: backgroundColors,
              borderWidth: 2,
              borderColor: '#ffffff',
              hoverOffset: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  font: {
                    family: 'Sarabun',
                    size: 12
                  },
                  padding: 14,
                  usePointStyle: true
                }
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    if (totalResults === 0) return 'ยังไม่มีข้อมูลผลสอบ';
                    const label = context.label || '';
                    return ` ${label}`;
                  }
                }
              }
            }
          }
        });
      }
    }

    function updateMembersTable() {
      const tbody = document.getElementById('members-table');
      const members = getMembers();
      if (members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-500">ไม่พบข้อมูล</td></tr>';
        return;
      }
      tbody.innerHTML = members.map((m, i) => `
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-3 text-sm">${i + 1}</td>
          <td class="px-4 py-3 text-sm font-medium">${m.username}</td>
          <td class="px-4 py-3 text-sm">${m.fullname}</td>
          <td class="px-4 py-3 text-sm">${m.email}</td>
          <td class="px-4 py-3">
            <span class="badge ${m.status === 'active' ? 'badge-success' : 'badge-warning'}">
              ${m.status === 'active' ? 'อนุมัติแล้ว' : 'รออนุมัติ'}
            </span>
          </td>
          <td class="px-4 py-3">
            <span class="badge badge-info">${m.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ครู'}</span>
          </td>
          <td class="px-4 py-3 text-center">
            <button onclick="editMember('${m.__backendId}')" class="text-primary-500 hover:text-primary-600 mx-1" title="แก้ไข">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="deleteMember('${m.__backendId}')" class="text-red-500 hover:text-red-600 mx-1" title="ลบ">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }

    function editMember(backendId) {
      const member = appData.find(d => d.__backendId === backendId);
      if (!member) return;

      const mainAdmin = getMembers().find(m => m.role === 'admin');
      if (!currentUser || currentUser.__backendId !== mainAdmin?.__backendId) {
        showAlert('error', 'ไม่มีสิทธิ์', 'เฉพาะผู้ดูแลระบบหลักเท่านั้นที่สามารถแก้ไขสมาชิก');
        return;
      }

      showActionConfirm({
        title: 'ยืนยันการแก้ไขสมาชิก',
        message: `คุณต้องการเปิดแก้ไขข้อมูลของสมาชิก "${member.fullname}" (ชื่อผู้ใช้: ${member.username}) ใช่หรือไม่?`,
        icon: 'fa-user-pen',
        iconColor: 'text-primary-600',
        iconBg: 'bg-primary-100',
        confirmText: 'เปิดแก้ไข',
        confirmClass: 'bg-primary-600 hover:bg-primary-700 text-white',
        onConfirm: () => {
          document.getElementById('edit-member-id').value = backendId;
          document.getElementById('edit-member-username').value = member.username;
          document.getElementById('edit-member-fullname').value = member.fullname;
          document.getElementById('edit-member-email').value = member.email;
          document.getElementById('edit-member-status').value = member.status;
          document.getElementById('edit-member-role').value = member.role;
          showModal('edit-member-modal');
        }
      });
    }

    function deleteMember(backendId) {
      const member = appData.find(d => d.__backendId === backendId);
      if (!member) return;

      const members = getMembers();
      const mainAdmin = members.find(m => m.role === 'admin');
      
      if (!currentUser || !mainAdmin || currentUser.__backendId !== mainAdmin.__backendId) {
        showAlert('error', 'ไม่มีสิทธิ์', 'เฉพาะผู้ดูแลระบบหลักเท่านั้นที่สามารถลบสมาชิก');
        return;
      }

      if (currentUser.__backendId === backendId) {
        showAlert('error', 'ไม่สามารถลบได้', 'ผู้ดูแลระบบหลักไม่สามารถลบตัวเองได้');
        return;
      }

      showConfirmDelete(`คุณต้องการลบสมาชิก "${member.fullname}" (ชื่อผู้ใช้: ${member.username}) นี้ใช่หรือไม่?`, async () => {
        const result = await window.dataSdk.delete(member);
        if (result.isOk) {
          logActivity(`ลบสมาชิก: ${member.username}`);
          showAlert('success', 'สำเร็จ', `ลบสมาชิก "${member.fullname}" เรียบร้อยแล้ว`);
        }
      });
    }

    function updateExamsTable() {
      const tbody = document.getElementById('exams-table');
      const exams = getExams();
      if (exams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-500">ไม่พบข้อมูล</td></tr>';
        return;
      }
      tbody.innerHTML = exams.map((e, i) => {
        const questions = e.questions ? (typeof e.questions === 'string' ? JSON.parse(e.questions) : e.questions) : { mc: [], essay: [] };
        const totalQuestions = (questions.mc?.length || 0) + (questions.essay?.length || 0);
        const passScore = e.passing_score !== undefined ? e.passing_score : (e.total_score / 2);
        return `
          <tr class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm">${i + 1}</td>
            <td class="px-4 py-3 text-sm font-medium">${e.subject_name}</td>
            <td class="px-4 py-3 text-sm">${totalQuestions} ข้อ</td>
            <td class="px-4 py-3 text-sm">${e.total_score} <span class="text-xs text-gray-500">(${passScore})</span></td>
            <td class="px-4 py-3 text-sm">${e.time_limit} นาที</td>
            <td class="px-4 py-3">
              <span class="badge ${e.is_visible ? 'badge-success' : 'badge-danger'}">
                ${e.is_visible ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
              </span>
            </td>
            <td class="px-4 py-3 text-center">
              <button onclick="editExamQuestions('${e.__backendId}')" class="px-3 py-1 rounded text-white text-xs font-medium bg-blue-500 hover:bg-blue-600 transition mb-1" title="แก้ไข">
                <i class="fas fa-edit mr-1"></i>แก้ไข
              </button>
              <button onclick="toggleExamVisibility('${e.__backendId}')" class="px-3 py-1 rounded text-white text-xs font-medium transition mb-1 ${e.is_visible ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 hover:bg-gray-500'}" title="${e.is_visible ? 'ซ่อนรายวิชา' : 'แสดงรายวิชา'}">
                <i class="fas fa-${e.is_visible ? 'eye' : 'eye-slash'} mr-1"></i>${e.is_visible ? 'แสดง' : 'ซ่อน'}
              </button>
              <button onclick="toggleExamAnswer('${e.__backendId}')" class="px-3 py-1 rounded text-white text-xs font-medium transition mb-1 ${e.show_answer ? 'bg-purple-500 hover:bg-purple-600' : 'bg-gray-400 hover:bg-gray-500'}" title="${e.show_answer ? 'ปิดเฉลย' : 'เปิดเฉลย'}">
                <i class="fas fa-${e.show_answer ? 'book-open' : 'book'} mr-1"></i>เฉลย
              </button>
              <button onclick="toggleShuffleQuestions('${e.__backendId}')" class="px-3 py-1 rounded text-white text-xs font-medium transition mb-1 ${e.shuffle_questions ? 'bg-cyan-500 hover:bg-cyan-600' : 'bg-gray-400 hover:bg-gray-500'}" title="${e.shuffle_questions ? 'ปิดสุ่มข้อ' : 'เปิดสุ่มข้อ'}">
                <i class="fas fa-shuffle mr-1"></i>สุ่มข้อ
              </button>
              <button onclick="toggleShuffleChoices('${e.__backendId}')" class="px-3 py-1 rounded text-white text-xs font-medium transition mb-1 ${e.shuffle_choices ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-gray-400 hover:bg-gray-500'}" title="${e.shuffle_choices ? 'ปิดสุ่มตัวเลือก' : 'เปิดสุ่มตัวเลือก'}">
                <i class="fas fa-list mr-1"></i>สุ่มตัวเลือก
              </button>
              <button onclick="duplicateExam('${e.__backendId}')" class="px-3 py-1 rounded text-white text-xs font-medium bg-blue-500 hover:bg-blue-600 transition mb-1" title="ทำซ้ำ">
                <i class="fas fa-copy mr-1"></i>ทำซ้ำ
              </button>
              <button onclick="deleteExam('${e.__backendId}')" class="px-3 py-1 rounded text-white text-xs font-medium bg-red-500 hover:bg-red-600 transition mb-1" title="ลบ">
                <i class="fas fa-trash mr-1"></i>ลบ
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    function editExamQuestions(backendId) {
      const exam = appData.find(d => d.__backendId === backendId);
      if (!exam) return;

      showActionConfirm({
        title: 'ยืนยันการแก้ไขชุดข้อสอบ',
        message: `คุณต้องการเปิดแก้ไขชุดข้อสอบวิชา "${exam.subject_name}" ใช่หรือไม่?`,
        icon: 'fa-file-pen',
        iconColor: 'text-primary-600',
        iconBg: 'bg-primary-100',
        confirmText: 'เปิดแก้ไขข้อสอบ',
        confirmClass: 'bg-primary-600 hover:bg-primary-700 text-white',
        onConfirm: () => {
          const rawQuestions = exam.questions ? (typeof exam.questions === 'string' ? JSON.parse(exam.questions) : exam.questions) : { mc: [], essay: [] };
          const questions = {
            mc: (rawQuestions.mc || []).map((q, idx) => ({ ...q, id: q.id || `mc_${idx}` })),
            essay: (rawQuestions.essay || []).map((q, idx) => ({ ...q, id: q.id || `essay_${idx}` }))
          };

          document.getElementById('exam-subject-name').value = exam.subject_name;
          document.getElementById('exam-total-score').value = exam.total_score;
          document.getElementById('exam-passing-score').value = exam.passing_score !== undefined ? exam.passing_score : (exam.total_score / 2);
          document.getElementById('exam-time-limit').value = exam.time_limit;
          document.getElementById('exam-score-per-question').value = exam.score_per_question;
          document.getElementById('exam-visible').checked = exam.is_visible;
          document.getElementById('exam-show-answer').checked = exam.show_answer;
          document.getElementById('exam-shuffle-questions').checked = exam.shuffle_questions;
          document.getElementById('exam-shuffle-choices').checked = exam.shuffle_choices;

          let mcText = '';
          questions.mc.forEach((q, idx) => {
            mcText += `${idx + 1}.${q.question}\n`;
            q.choices.forEach(c => {
              mcText += `${c.key}.${c.text}\n`;
            });
            mcText += `เฉลย: ${q.answer}.\n`;
            mcText += `คะแนน: ${q.score}\n\n`;
          });

          let essayText = '';
          questions.essay.forEach((q, idx) => {
            essayText += `${idx + 1}.${q.question}\n`;
            essayText += `คะแนน: ${q.maxScore}\n\n`;
          });

          document.getElementById('mc-input').value = mcText.trim();
          document.getElementById('essay-input').value = essayText.trim();

          parsedMCQuestions = [...questions.mc];
          parsedEssayQuestions = [...questions.essay];

          if (parsedMCQuestions.length > 0) {
            document.getElementById('mc-preview').classList.remove('hidden');
            document.getElementById('mc-preview-count').innerHTML = `✓ พบ <strong class="text-blue-600">${parsedMCQuestions.length}</strong> ข้อสอบปรนัย`;
          }

          if (parsedEssayQuestions.length > 0) {
            document.getElementById('essay-preview').classList.remove('hidden');
            document.getElementById('essay-preview-count').innerHTML = `✓ พบ <strong class="text-orange-600">${parsedEssayQuestions.length}</strong> ข้อสอบอัตนัย`;
          }

          document.getElementById('edit-exam-id').value = backendId;
          document.getElementById('admin-create-exam').scrollIntoView({ behavior: 'smooth' });
          showAdminPage('create-exam');
          showAlert('info', 'เข้าสู่โหมดแก้ไขข้อสอบ', `กำลังแก้ไขข้อสอบวิชา "${exam.subject_name}"`);
        }
      });
    }

    async function toggleExamVisibility(backendId) {
      const exam = appData.find(d => d.__backendId === backendId);
      if (!exam) return;

      const actionText = exam.is_visible ? 'ซ่อนรายวิชา' : 'เปิดแสดงรายวิชา';
      showActionConfirm({
        title: `ยืนยันการ${actionText}`,
        message: `คุณต้องการ${actionText} "${exam.subject_name}" ใช่หรือไม่?`,
        icon: exam.is_visible ? 'fa-eye-slash' : 'fa-eye',
        iconColor: exam.is_visible ? 'text-amber-600' : 'text-emerald-600',
        iconBg: exam.is_visible ? 'bg-amber-100' : 'bg-emerald-100',
        confirmText: `ยืนยัน${actionText}`,
        confirmClass: exam.is_visible ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white',
        onConfirm: async () => {
          const result = await window.dataSdk.update({ ...exam, is_visible: !exam.is_visible });
          if (result.isOk) {
            logActivity(`เปลี่ยนสถานะเปิด-ปิดข้อสอบวิชา: ${exam.subject_name}`);
            showAlert('success', 'สำเร็จ', exam.is_visible ? `ซ่อนรายวิชา "${exam.subject_name}" เรียบร้อยแล้ว` : `เปิดแสดงรายวิชา "${exam.subject_name}" เรียบร้อยแล้ว`);
          }
        }
      });
    }

    async function toggleExamAnswer(backendId) {
      const exam = appData.find(d => d.__backendId === backendId);
      if (!exam) return;

      const actionText = exam.show_answer ? 'ปิดการแสดงเฉลย' : 'เปิดการแสดงเฉลย';
      showActionConfirm({
        title: `ยืนยันการ${actionText}`,
        message: `คุณต้องการ${actionText}ของวิชา "${exam.subject_name}" ให้นักเรียนดูหลังสอบเสร็จใช่หรือไม่?`,
        icon: exam.show_answer ? 'fa-book' : 'fa-book-open',
        iconColor: exam.show_answer ? 'text-amber-600' : 'text-purple-600',
        iconBg: exam.show_answer ? 'bg-amber-100' : 'bg-purple-100',
        confirmText: `ยืนยัน${actionText}`,
        confirmClass: exam.show_answer ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white',
        onConfirm: async () => {
          const result = await window.dataSdk.update({ ...exam, show_answer: !exam.show_answer });
          if (result.isOk) {
            logActivity(`เปลี่ยนสถานะเปิด-ปิดเฉลยวิชา: ${exam.subject_name}`);
            showAlert('success', 'สำเร็จ', exam.show_answer ? `ปิดการแสดงเฉลยวิชา "${exam.subject_name}" เรียบร้อยแล้ว` : `เปิดการแสดงเฉลยวิชา "${exam.subject_name}" เรียบร้อยแล้ว`);
          }
        }
      });
    }

    async function toggleShuffleQuestions(backendId) {
      const exam = appData.find(d => d.__backendId === backendId);
      if (!exam) return;

      const actionText = exam.shuffle_questions ? 'ปิดการสุ่มลำดับข้อสอบ' : 'เปิดการสุ่มลำดับข้อสอบ';
      showActionConfirm({
        title: `ยืนยันการ${actionText}`,
        message: `คุณต้องการ${actionText}ของวิชา "${exam.subject_name}" ใช่หรือไม่?`,
        icon: 'fa-shuffle',
        iconColor: 'text-cyan-600',
        iconBg: 'bg-cyan-100',
        confirmText: `ยืนยัน${actionText}`,
        confirmClass: 'bg-cyan-600 hover:bg-cyan-700 text-white',
        onConfirm: async () => {
          const result = await window.dataSdk.update({ ...exam, shuffle_questions: !exam.shuffle_questions });
          if (result.isOk) {
            logActivity(`สลับการตั้งค่าสุ่มข้อสอบวิชา: ${exam.subject_name}`);
            showAlert('success', 'สำเร็จ', exam.shuffle_questions ? `ปิดการสุ่มลำดับข้อวิชา "${exam.subject_name}" เรียบร้อยแล้ว` : `เปิดการสุ่มลำดับข้อวิชา "${exam.subject_name}" เรียบร้อยแล้ว`);
          }
        }
      });
    }

    async function toggleShuffleChoices(backendId) {
      const exam = appData.find(d => d.__backendId === backendId);
      if (!exam) return;

      const actionText = exam.shuffle_choices ? 'ปิดการสุ่มตัวเลือก' : 'เปิดการสุ่มตัวเลือก';
      showActionConfirm({
        title: `ยืนยันการ${actionText}`,
        message: `คุณต้องการ${actionText}ของวิชา "${exam.subject_name}" ใช่หรือไม่?`,
        icon: 'fa-list-ol',
        iconColor: 'text-indigo-600',
        iconBg: 'bg-indigo-100',
        confirmText: `ยืนยัน${actionText}`,
        confirmClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        onConfirm: async () => {
          const result = await window.dataSdk.update({ ...exam, shuffle_choices: !exam.shuffle_choices });
          if (result.isOk) {
            logActivity(`สลับการตั้งค่าสุ่มตัวเลือกวิชา: ${exam.subject_name}`);
            showAlert('success', 'สำเร็จ', exam.shuffle_choices ? `ปิดการสุ่มตัวเลือกวิชา "${exam.subject_name}" เรียบร้อยแล้ว` : `เปิดการสุ่มตัวเลือกวิชา "${exam.subject_name}" เรียบร้อยแล้ว`);
          }
        }
      });
    }

    async function duplicateExam(backendId) {
      const exam = appData.find(d => d.__backendId === backendId);
      if (!exam) return;

      showActionConfirm({
        title: 'ยืนยันการทำซ้ำชุดข้อสอบ',
        message: `คุณต้องการทำซ้ำชุดข้อสอบวิชา "${exam.subject_name}" ใช่หรือไม่?`,
        icon: 'fa-copy',
        iconColor: 'text-blue-600',
        iconBg: 'bg-blue-100',
        confirmText: 'ทำซ้ำชุดข้อสอบ',
        confirmClass: 'bg-blue-600 hover:bg-blue-700 text-white',
        onConfirm: async () => {
          const newExam = {
            ...exam,
            id: generateId(),
            subject_name: exam.subject_name + ' (สำเนา)',
            created_at: new Date().toISOString()
          };
          delete newExam.__backendId;
          
          const result = await window.dataSdk.create(newExam);
          if (result.isOk) {
            logActivity(`ทำซ้ำชุดข้อสอบ: ${newExam.subject_name}`);
            showAlert('success', 'สำเร็จ', `ทำซ้ำชุดข้อสอบ "${newExam.subject_name}" เรียบร้อยแล้ว`);
          }
        }
      });
    }

    function deleteExam(backendId) {
      const exam = appData.find(d => d.__backendId === backendId);
      if (!exam) return;

      showConfirmDelete(`คุณต้องการลบชุดข้อสอบวิชา "${exam.subject_name}" นี้ใช่หรือไม่?`, async () => {
        const result = await window.dataSdk.delete(exam);
        if (result.isOk) {
          logActivity(`ลบชุดข้อสอบ: ${exam.subject_name}`);
          showAlert('success', 'สำเร็จ', `ลบข้อสอบวิชา "${exam.subject_name}" เรียบร้อยแล้ว`);
        }
      });
    }

    function updateStudentsTable() {
      const filterSelect = document.getElementById('students-filter-subject');
      const students = getStudents();
      
      const subjects = [...new Set(students.map(s => s.subject_name))].sort();
      const currentValue = filterSelect.value;
      filterSelect.innerHTML = '<option value="">ทั้งหมด</option>';
      subjects.forEach(subject => {
        filterSelect.innerHTML += `<option value="${subject}">${subject}</option>`;
      });
      filterSelect.value = currentValue;
      
      filterStudentsTable();
    }

    function filterStudentsTable() {
      const tbody = document.getElementById('students-table');
      const filterValue = document.getElementById('students-filter-subject').value;
      const students = getStudents();
      
      const filtered = filterValue ? students.filter(s => s.subject_name === filterValue) : students;
      
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-500">ไม่พบข้อมูล</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map((s, i) => {
        const result = getResults().find(r => r.student_id === s.student_id && r.subject_id === s.subject_id);
        const isCheating = result && result.warnings >= 4;
        const statusBadge = isCheating 
          ? '<span class="badge badge-danger"><i class="fas fa-exclamation-triangle mr-1"></i>ตรวจพบทุจริต</span>'
          : result ? `<span class="badge badge-success"><i class="fas fa-check-circle mr-1"></i>สอบแล้ว</span>` 
          : '<span class="badge badge-warning"><i class="fas fa-hourglass-half mr-1"></i>รอสอบ</span>';
        return `
          <tr class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm">${i + 1}</td>
            <td class="px-4 py-3 text-sm font-medium">${s.student_id}</td>
            <td class="px-4 py-3 text-sm">${s.fullname}</td>
            <td class="px-4 py-3 text-sm">${s.class_name}/${s.room}</td>
            <td class="px-4 py-3 text-sm">${s.number}</td>
            <td class="px-4 py-3 text-sm">${s.subject_name}</td>
            <td class="px-4 py-3">${statusBadge}</td>
            <td class="px-4 py-3 text-center">
              <button onclick="deleteStudent('${s.__backendId}')" class="text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition" title="ลบข้อมูลผู้สอบ">
                <i class="fas fa-trash mr-1"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    function deleteStudent(backendId) {
      const student = appData.find(d => d.__backendId === backendId);
      if (!student) return;

      showConfirmDelete(`คุณต้องการลบข้อมูลผู้สอบ "${student.fullname}" (รหัส: ${student.student_id}) ในวิชา "${student.subject_name}" ใช่หรือไม่?`, async () => {
        const result = await window.dataSdk.delete(student);
        if (result.isOk) {
          logActivity(`ลบข้อมูลผู้สอบ: ${student.student_id} (${student.fullname})`);
          showAlert('success', 'สำเร็จ', `ลบข้อมูลผู้สอบ "${student.fullname}" เรียบร้อยแล้ว`);
        }
      });
    }

    function updateResultsTable() {
      const filterSelect = document.getElementById('results-filter-subject');
      const results = getResults();
      
      const subjects = [...new Set(results.map(r => r.subject_name))].sort();
      const currentValue = filterSelect.value;
      filterSelect.innerHTML = '<option value="">ทั้งหมด</option>';
      subjects.forEach(subject => {
        filterSelect.innerHTML += `<option value="${subject}">${subject}</option>`;
      });
      filterSelect.value = currentValue;
      
      filterResultsTable();
    }

    function filterResultsTable() {
      const tbody = document.getElementById('results-table');
      const filterValue = document.getElementById('results-filter-subject').value;
      const results = getResults();
      
      const filtered = filterValue ? results.filter(r => r.subject_name === filterValue) : results;
      
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="px-4 py-8 text-center text-gray-500">ไม่พบข้อมูล</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map((r, i) => {
        const mcScore = r.mc_score !== undefined ? r.mc_score : 0;
        const essayScoreDisplay = r.essay_score !== undefined ? r.essay_score : (r.graded ? 0 : '<span class="text-orange-500 font-medium">รอตรวจ</span>');
        return `
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-3 text-sm">${i + 1}</td>
          <td class="px-4 py-3 text-sm font-medium">${r.student_id} - ${r.fullname}</td>
          <td class="px-4 py-3 text-sm">${r.subject_name}</td>
          <td class="px-4 py-3 text-sm font-semibold text-blue-600">${mcScore}</td>
          <td class="px-4 py-3 text-sm font-semibold text-orange-600">${essayScoreDisplay}</td>
          <td class="px-4 py-3 text-sm font-bold text-primary-600">${r.score}/${r.total_score}</td>
          <td class="px-4 py-3 text-sm">${new Date(r.submitted_at).toLocaleString('th-TH')}</td>
          <td class="px-4 py-3">
            <span class="badge ${r.graded ? 'badge-success' : 'badge-warning'}">
              ${r.graded ? 'ตรวจแล้ว' : 'รอตรวจ'}
            </span>
          </td>
          <td class="px-4 py-3 text-center">
            <button onclick="viewResultDetails('${r.__backendId || r.id}')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium mr-1 transition" title="ดูคำตอบอย่างละเอียด">
              <i class="fas fa-eye mr-1"></i>ดูคำตอบ
            </button>
            <button onclick="deleteResult('${r.__backendId || r.id}')" class="text-red-500 hover:text-red-600 px-2 py-1" title="ลบผลสอบ">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
      }).join('');
    }

    function viewResultDetails(backendId) {
      const resultData = appData.find(d => d.__backendId === backendId || d.id === backendId);
      if (!resultData) {
        showAlert('warning', 'ไม่พบข้อมูล', 'ไม่พบข้อมูลผลสอบที่ต้องการดู');
        return;
      }

      const exam = appData.find(e => (e.id === resultData.subject_id || e.__backendId === resultData.subject_id) && e.type === 'exam');
      const rawQuestions = exam && exam.questions ? (typeof exam.questions === 'string' ? JSON.parse(exam.questions) : exam.questions) : { mc: [], essay: [] };
      const rawAnswers = resultData.answers ? (typeof resultData.answers === 'string' ? JSON.parse(resultData.answers) : resultData.answers) : { mc: {}, essay: {} };

      const answers = {
        mc: rawAnswers.mc || {},
        essay: rawAnswers.essay || {}
      };

      const questions = {
        mc: (rawQuestions.mc || []).map((q, idx) => ({ ...q, id: q.id || `mc_${idx}` })),
        essay: (rawQuestions.essay || []).map((q, idx) => ({ ...q, id: q.id || `essay_${idx}` }))
      };

      let html = `
        <div class="bg-gray-50 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm border">
          <p><strong>ผู้สอบ:</strong> ${resultData.fullname} (${resultData.student_id})</p>
          <p><strong>ชั้น/ห้อง:</strong> ${resultData.class_name}/${resultData.room} เลขที่ ${resultData.number}</p>
          <p><strong>รายวิชา:</strong> ${resultData.subject_name}</p>
          <p><strong>เวลาส่งคำตอบ:</strong> ${new Date(resultData.submitted_at).toLocaleString('th-TH')}</p>
          <p><strong>คะแนนรวม:</strong> <span class="text-primary-600 font-bold text-base">${resultData.score} / ${resultData.total_score}</span></p>
          <p><strong>สถานะการตรวจ:</strong> ${resultData.graded ? '<span class="badge badge-success">ตรวจแล้ว</span>' : '<span class="badge badge-warning">รอตรวจ</span>'}</p>
        </div>
      `;

      if (resultData.cheating_detected || resultData.warnings >= 4) {
        html += `
          <div class="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-4 text-center text-red-700">
            <i class="fas fa-exclamation-triangle text-3xl text-red-500 mb-2"></i>
            <p class="font-bold">ตรวจพบการทุจริตในระหว่างสอบ (${resultData.warnings || 4} ครั้ง)</p>
          </div>
        `;
      }

      html += `<h4 class="font-bold text-gray-800 mb-3"><i class="fas fa-list-ol mr-2 text-primary-500"></i>รายละเอียดการตอบข้อสอบ:</h4>`;

      if (questions.mc && questions.mc.length > 0) {
        questions.mc.forEach((q, idx) => {
          const studentAns = answers.mc[q.id] !== undefined ? answers.mc[q.id] : answers.mc[idx];
          const isCorrect = studentAns === q.answer;
          html += `
            <div class="p-4 border-2 ${isCorrect ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'} rounded-xl mb-3">
              <div class="flex justify-between items-start mb-2">
                <p class="font-bold text-gray-800"><span class="text-primary-600">ข้อที่ ${idx + 1}.</span> ${q.question}</p>
                <span class="badge ${isCorrect ? 'badge-success' : 'badge-danger'} whitespace-nowrap">
                  ${isCorrect ? '✓ ถูกต้อง' : '✗ ผิด'} (${isCorrect ? (q.score || (exam && exam.score_per_question) || 1) : 0}/${q.score || (exam && exam.score_per_question) || 1} คะแนน)
                </span>
              </div>
              <div class="space-y-1 text-sm pl-4 my-2">
                ${q.choices.map(c => `
                  <div class="p-1 rounded ${c.key === q.answer ? 'bg-green-100 font-bold text-green-800' : (c.key === studentAns ? 'bg-red-100 text-red-800 font-semibold' : 'text-gray-700')}">
                    <span class="mr-2">${c.key}.</span> ${c.text}
                    ${c.key === q.answer ? ' <i class="fas fa-check text-green-600 ml-2" title="คำตอบที่ถูกต้อง"></i>' : ''}
                    ${c.key === studentAns && c.key !== q.answer ? ' <i class="fas fa-times text-red-600 ml-2" title="ผู้สอบเลือกข้อนี้"></i>' : ''}
                  </div>
                `).join('')}
              </div>
              <p class="text-xs text-gray-600 mt-2">คำตอบของผู้สอบ: <strong class="${isCorrect ? 'text-green-700' : 'text-red-700'}">${studentAns || 'ไม่ได้ตอบ'}</strong> | เฉลยที่ถูกต้อง: <strong class="text-green-700">${q.answer}</strong></p>
            </div>
          `;
        });
      }

      if (questions.essay && questions.essay.length > 0) {
        questions.essay.forEach((q, idx) => {
          const essayAns = answers.essay[q.id] !== undefined ? answers.essay[q.id] : answers.essay[idx];
          html += `
            <div class="p-4 border-2 border-orange-200 bg-orange-50/50 rounded-xl mb-3">
              <p class="font-bold text-gray-800 mb-2"><span class="text-orange-600">ข้อที่ ${(questions.mc?.length || 0) + idx + 1} (อัตนัย).</span> ${q.question}</p>
              <div class="bg-white p-3 rounded-lg border text-sm text-gray-800 font-sarabun mb-2 whitespace-pre-wrap">
                ${essayAns || '<em class="text-gray-400">ผู้สอบไม่ได้ตอบข้อนี้</em>'}
              </div>
              <p class="text-xs text-orange-700 font-medium"><i class="fas fa-star mr-1"></i>คะแนนเต็ม: ${q.maxScore || (exam && exam.score_per_question) || 1}</p>
            </div>
          `;
        });
      }

      const contentEl = document.getElementById('view-result-content');
      if (contentEl) {
        contentEl.innerHTML = html;
      }
      showModal('view-result-modal');
    }

    function deleteResult(backendId) {
      const result_data = appData.find(d => d.__backendId === backendId);
      if (!result_data) return;

      showConfirmDelete(`คุณต้องการลบผลสอบของ "${result_data.fullname}" (รหัส: ${result_data.student_id}) ในวิชา "${result_data.subject_name}" ใช่หรือไม่?`, async () => {
        const result = await window.dataSdk.delete(result_data);
        if (result.isOk) {
          logActivity(`ลบผลสอบนักเรียน: ${result_data.student_id} (${result_data.fullname})`);
          showAlert('success', 'สำเร็จ', `ลบผลสอบของ "${result_data.fullname}" เรียบร้อยแล้ว`);
        }
      });
    }

    function updateGradingTable() {
      const filterSelect = document.getElementById('grading-filter-subject');
      const results = getResults().filter(r => !r.graded && !r.cheating_detected);
      
      const subjects = [...new Set(results.map(r => r.subject_name))].sort();
      const currentValue = filterSelect.value;
      filterSelect.innerHTML = '<option value="">ทั้งหมด</option>';
      subjects.forEach(subject => {
        filterSelect.innerHTML += `<option value="${subject}">${subject}</option>`;
      });
      filterSelect.value = currentValue;
      
      filterGradingTable();
    }

    function filterGradingTable() {
      const tbody = document.getElementById('grading-table');
      const filterValue = document.getElementById('grading-filter-subject').value;
      const results = getResults().filter(r => !r.graded && !r.cheating_detected);
      
      const filtered = filterValue ? results.filter(r => r.subject_name === filterValue) : results;
      
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">ไม่พบข้อมูลที่ต้องตรวจ</td></tr>';
        return;
      }
      tbody.innerHTML = filtered.map((r, i) => `
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-3 text-sm">${i + 1}</td>
          <td class="px-4 py-3 text-sm font-medium">${r.student_id} - ${r.fullname}</td>
          <td class="px-4 py-3 text-sm">${r.subject_name}</td>
          <td class="px-4 py-3">
            <span class="badge badge-warning">รอตรวจ</span>
          </td>
          <td class="px-4 py-3 text-center">
            <button onclick="openGrading('${r.__backendId}')" class="bg-primary-500 hover:bg-primary-600 text-white px-3 py-1 rounded-lg text-sm">
              <i class="fas fa-pen mr-1"></i> ตรวจ
            </button>
          </td>
        </tr>
      `).join('');
    }

    function openGrading(backendId) {
      const result_data = appData.find(d => d.__backendId === backendId);
      if (!result_data) return;

      showActionConfirm({
        title: 'ยืนยันการตรวจข้อสอบอัตนัย',
        message: `คุณต้องการตรวจและให้คะแนนข้อสอบอัตนัยของ "${result_data.fullname}" (รหัส ${result_data.student_id}) ในวิชา "${result_data.subject_name}" ใช่หรือไม่?`,
        icon: 'fa-pen-clip',
        iconColor: 'text-primary-600',
        iconBg: 'bg-primary-100',
        confirmText: 'เริ่มตรวจข้อสอบ',
        confirmClass: 'bg-primary-600 hover:bg-primary-700 text-white',
        onConfirm: () => {
          currentGradingResult = result_data;
          const rawAnswers = result_data.answers ? (typeof result_data.answers === 'string' ? JSON.parse(result_data.answers) : result_data.answers) : { mc: {}, essay: {} };
          const answers = { mc: rawAnswers.mc || {}, essay: rawAnswers.essay || {} };

          const exam = getExams().find(e => e.id === result_data.subject_id);
          
          if (!exam) {
            showAlert('error', 'ผิดพลาด', 'ไม่พบข้อสอบ');
            return;
          }

          const rawQuestions = (typeof currentExam.questions === 'string') ? JSON.parse(currentExam.questions) : currentExam.questions;
          const essayQuestions = (rawQuestions.essay || []).map((q, idx) => ({ ...q, id: q.id || `essay_${idx}` }));

          const content = document.getElementById('grading-content');
          content.innerHTML = `
            <div class="bg-gray-50 rounded-lg p-4 mb-4">
              <p class="font-medium">${result_data.student_id} - ${result_data.fullname}</p>
              <p class="text-sm text-gray-500">${result_data.subject_name}</p>
            </div>
            ${essayQuestions.map((q, i) => {
              const essayAns = answers.essay[q.id] !== undefined ? answers.essay[q.id] : answers.essay[i];
              return `
                <div class="border border-gray-200 rounded-lg p-4">
                  <p class="font-medium text-gray-800 mb-2">ข้อที่ ${i + 1}: ${q.question}</p>
                  <div class="bg-blue-50 rounded p-3 mb-3">
                    <p class="text-sm text-gray-500 mb-1">คำตอบ:</p>
                    <p class="text-gray-800 font-sarabun">${essayAns || '<em class="text-gray-400">ไม่ได้ตอบ</em>'}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <label class="text-sm text-gray-600">คะแนน:</label>
                    <input type="number" id="essay-score-${q.id}" min="0" max="${q.maxScore || exam.score_per_question}" step="0.5" value="0"
                      class="w-20 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none text-center">
                    <span class="text-sm text-gray-500">/ ${q.maxScore || exam.score_per_question}</span>
                  </div>
                </div>
              `;
            }).join('')}
          `;
          showModal('grading-modal');
        }
      });
    }

    async function saveGrading(event) {
      if (!currentGradingResult) return;

      const studentName = currentGradingResult.fullname;
      const studentId = currentGradingResult.student_id;
      const subjectName = currentGradingResult.subject_name;

      showActionConfirm({
        title: 'ยืนยันการบันทึกคะแนนอัตนัย',
        message: `คุณต้องการบันทึกคะแนนการตรวจข้อสอบอัตนัยของ "${studentName}" (รหัส ${studentId})\nวิชา "${subjectName}" ใช่หรือไม่?`,
        icon: 'fa-check-double',
        iconColor: 'text-emerald-600',
        iconBg: 'bg-emerald-100',
        confirmText: 'บันทึกคะแนน',
        confirmClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        onConfirm: async () => {
          const btn = event.target.closest('button');
          setButtonLoading(btn, true, 'กำลังบันทึก...');

          const exam = getExams().find(e => e.id === currentGradingResult.subject_id);
          if (!exam) {
            setButtonLoading(btn, false);
            return;
          }

          const rawQuestions = (typeof currentExam.questions === 'string') ? JSON.parse(currentExam.questions) : currentExam.questions;
          const essayQuestions = (rawQuestions.essay || []).map((q, idx) => ({ ...q, id: q.id || `essay_${idx}` }));
          let essayScore = 0;

          essayQuestions.forEach((q, i) => {
            const scoreInput = document.getElementById(`essay-score-${q.id}`) || document.getElementById(`essay-score-${i}`);
            if (scoreInput) {
              essayScore += parseFloat(scoreInput.value) || 0;
            }
          });

          const mcScore = currentGradingResult.mc_score || 0;
          const totalScore = mcScore + essayScore;

          const result = await window.dataSdk.update({
            ...currentGradingResult,
            score: totalScore,
            essay_score: essayScore,
            graded: true
          });

          setButtonLoading(btn, false);

          if (result.isOk) {
            hideModal('grading-modal');
            logActivity(`ตรวจให้คะแนนอัตนัยนักเรียน: ${currentGradingResult.student_id} (${studentName}) รวมได้ ${totalScore} คะแนน`);
            showAlert('success', 'สำเร็จ', `บันทึกคะแนนของ "${studentName}" เรียบร้อยแล้ว`);
            currentGradingResult = null;
          }
        }
      });
    }

    function updateTimeSettings() {
      const container = document.getElementById('time-settings-list');
      const exams = getExams();
      if (exams.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">ไม่พบข้อสอบที่ต้องตั้งค่า</p>';
        return;
      }
      container.innerHTML = exams.map(e => `
        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div>
            <p class="font-medium text-gray-800">${e.subject_name}</p>
            <p class="text-sm text-gray-500">เวลาปัจจุบัน: ${e.time_limit} นาที</p>
          </div>
          <div class="flex items-center gap-2">
            <input type="number" id="time-${e.__backendId}" value="${e.time_limit}" min="1"
              class="w-20 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none text-center">
            <span class="text-gray-500">นาที</span>
            <button onclick="updateExamTime('${e.__backendId}')" class="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition">
              <i class="fas fa-save"></i>
            </button>
          </div>
        </div>
      `).join('');
    }

    async function updateExamTime(backendId) {
      const exam = appData.find(d => d.__backendId === backendId);
      const newTime = parseInt(document.getElementById(`time-${backendId}`).value);
      if (!exam || !newTime || newTime <= 0) return;

      showActionConfirm({
        title: 'ยืนยันการบันทึกเวลาสอบ',
        message: `คุณต้องการบันทึกการปรับเวลาทำข้อสอบวิชา "${exam.subject_name}" เป็น ${newTime} นาที ใช่หรือไม่?`,
        icon: 'fa-clock',
        iconColor: 'text-primary-600',
        iconBg: 'bg-primary-100',
        confirmText: 'บันทึกเวลาสอบ',
        confirmClass: 'bg-primary-600 hover:bg-primary-700 text-white',
        onConfirm: async () => {
          const result = await window.dataSdk.update({ ...exam, time_limit: newTime });
          if (result.isOk) {
            logActivity(`ปรับเวลาสอบวิชา ${exam.subject_name} เป็น ${newTime} นาที`);
            showAlert('success', 'สำเร็จ', `บันทึกเวลาสอบวิชา "${exam.subject_name}" เป็น ${newTime} นาทีเรียบร้อยแล้ว`);
          }
        }
      });
    }

    function showAdminPage(page) {
      document.querySelectorAll('.admin-content').forEach(c => c.classList.add('hidden'));
      const target = document.getElementById(`admin-${page}`);
      if (target) target.classList.remove('hidden');
      
      document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) item.classList.add('active');
      });

      const titles = {
        'dashboard': 'แดชบอร์ด',
        'announcements': 'ประกาศ',
        'proctoring': 'คุมสอบ',
        'members': 'จัดการสมาชิก',
        'create-exam': 'สร้างข้อสอบ',
        'exams': 'จัดการข้อสอบ',
        'students': 'ข้อมูลผู้สอบ',
        'results': 'ผลสอบ',
        'grading': 'ตรวจอัตนัย',
        'settings': 'ตั้งค่าเวลา',
        'profile': 'แก้ไขข้อมูลส่วนตัว'
      };
      document.getElementById('admin-page-title').textContent = titles[page] || 'แดชบอร์ด';
    }

    function toggleSidebar() {
      const sidebar = document.getElementById('admin-sidebar');
      const isCollapsed = sidebar.style.marginLeft === '-256px';
      sidebar.style.marginLeft = isCollapsed ? '0' : '-256px';
    }

    async function refreshData() {
        try {
            document.getElementById('loading').classList.remove('hidden');
            const textEl = document.getElementById('loadingText');
            if (textEl) {
              textEl.innerText = "กำลังรีเฟรชข้อมูล...";
              textEl.className = "text-gray-600 text-lg transition-all duration-300";
            }
            const data = await window.dataSdk._callAPI('getData');
            appData = data || [];
            syncActivityLogs();
            updateUI();
            document.getElementById('loading').classList.add('hidden');
            showAlert('info', 'รีเฟรชข้อมูล', 'ข้อมูลได้รับการอัปเดตแล้ว');
        } catch (err) {
            document.getElementById('loading').classList.add('hidden');
            showAlert('error', 'ผิดพลาด', 'ไม่สามารถรีเฟรชข้อมูลได้');
        }
    }

    async function handleLogin(username, password) {
      try {
        const auth = await window.dataSdk._callAPI('login', { username, password });
        if (!auth || !auth.token || !auth.member) throw new Error('LOGIN_FAILED');
        adminAuthToken = auth.token;
        sessionStorage.setItem('dm_exam_admin_token', adminAuthToken);
        currentUser = auth.member;

        // โหลดข้อมูลสำหรับผู้ดูแลหลังยืนยันตัวตนสำเร็จเท่านั้น
        const data = await window.dataSdk._callAPI('getData');
        appData = Array.isArray(data) ? data : [];

        document.getElementById('admin-name').textContent = currentUser.fullname;
        document.getElementById('admin-role').textContent = currentUser.role === 'admin' ? 'ผู้ดูแลหลัก' : 'ครู';
        document.getElementById('profile-fullname').value = currentUser.fullname;
        document.getElementById('profile-email').value = currentUser.email;
        hideModal('admin-login-modal');
        showPage('admin');
        showAdminPage('dashboard');
        updateUI();
        logActivity(`ผู้ใช้ ${currentUser.fullname} เข้าสู่ระบบ`);
        showAlert('success', 'เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับ ${currentUser.fullname}`);

        if (proctoringInterval) clearInterval(proctoringInterval);
        proctoringInterval = setInterval(() => {
          if (!document.getElementById('page-admin').classList.contains('hidden') &&
              !document.getElementById('admin-proctoring').classList.contains('hidden')) {
            renderProctoringLive();
          }
        }, 4000);
        return true;
      } catch (err) {
        const msg = String(err && err.message || '');
        if (msg.includes('pending')) showAlert('warning', 'รออนุมัติ', 'บัญชีของคุณยังรออนุมัติจากผู้ดูแลระบบ');
        else if (msg.includes('Too many')) showAlert('warning', 'ลองใหม่ภายหลัง', 'มีการพยายามเข้าสู่ระบบหลายครั้งเกินไป');
        else showAlert('error', 'เข้าสู่ระบบไม่สำเร็จ', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        return false;
      }
    }

    function adminLogout() {
      handleLogout();
    }

    function handleLogout() {
      const fullname = currentUser?.fullname || 'ผู้ใช้งาน';
      logActivity(`ผู้ใช้ ${fullname} ออกจากระบบ`);
      currentUser = null;
      if (adminAuthToken) { window.dataSdk._callAPI('logout').catch(() => {}); }
      adminAuthToken = '';
      sessionStorage.removeItem('dm_exam_admin_token');
      sessionStorage.removeItem('dm_exam_student_token');
      currentStudentSessionToken = '';
      if (examTimer) clearInterval(examTimer);
      document.removeEventListener('contextmenu', preventAction);
      document.removeEventListener('copy', preventAction);
      document.removeEventListener('paste', preventAction);
      document.removeEventListener('cut', preventAction);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      
      showPage('home');
      showAlert('info', 'ออกจากระบบ', 'คุณได้ออกจากระบบเรียบร้อยแล้ว');
    }

    function parseMultipleChoice() {
      const input = document.getElementById('mc-input').value.trim();
      if (!input) {
        showAlert('warning', 'ไม่มีข้อมูล', 'กรุณาวางข้อสอบก่อน');
        return;
      }

      const btn = event.target;
      setButtonLoading(btn, true, 'กำลังแปลง...');

      setTimeout(() => {
        const questionBlocks = input.split(/\n(?=\d+[\.\、\)])/);
        parsedMCQuestions = [];

        questionBlocks.forEach((block, idx) => {
          const lines = block.trim().split('\n');
          if (lines.length < 3) return;

          const questionMatch = lines[0].match(/^\d+[\.\、\)]\s*(.*)/);
          if (!questionMatch) return;

          const question = questionMatch[1].trim();
          const choices = [];
          let answer = '';
          let score = 0;

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            const choiceMatch = line.match(/^([ก-จA-Ea-e1-5])[\.\、\)]\s*(.*)/);
            const answerMatch = line.match(/^(?:เฉลย|Answer|答案):\s*([ก-จA-Ea-e1-5])[\.\、\)]?/i);
            const scoreMatch = line.match(/^(?:คะแนน|Score|points|分數|分数|得分):\s*(\d+(?:\.\d+)?)/i);

            if (choiceMatch) {
              const rawKey = choiceMatch[1].toUpperCase();
              choices.push({ key: rawKey, text: choiceMatch[2].trim() });
            } else if (answerMatch) {
              answer = answerMatch[1].toUpperCase();
            } else if (scoreMatch) {
              score = parseFloat(scoreMatch[1]);
            }
          }

          if (question && choices.length >= 2 && answer) {
            parsedMCQuestions.push({ 
              id: 'mc_' + generateId() + '_' + idx,
              question, 
              choices, 
              answer, 
              score: score || 1 
            });
          }
        });

        setButtonLoading(btn, false);

        if (parsedMCQuestions.length > 0) {
          document.getElementById('mc-preview').classList.remove('hidden');
          const previewLimit = 3;
          document.getElementById('mc-preview-content').innerHTML = parsedMCQuestions.slice(0, previewLimit).map((q, i) => `
            <div class="border-2 border-blue-300 rounded-lg p-4 bg-gradient-to-br from-white to-blue-50 hover:shadow-lg transition">
              <div class="flex items-start justify-between mb-3">
                <p class="font-bold text-gray-900 flex-1"><span class="text-blue-600 bg-blue-100 px-2 py-1 rounded">ข้อที่ ${i + 1}</span> ${q.question}</p>
                <span class="badge badge-info ml-2 whitespace-nowrap"><i class="fas fa-star mr-1"></i>${q.score} คะแนน</span>
              </div>
              <div class="space-y-2 pl-4 text-sm">
                ${q.choices.map(c => `
                  <p class="${c.key === q.answer ? 'text-green-600 font-bold bg-green-50 -ml-4 pl-4 py-1' : 'text-gray-700'}">
                    <span class="font-semibold">${c.key}.</span> ${c.text} ${c.key === q.answer ? '<i class="fas fa-check-circle ml-2 text-green-500"></i>' : ''}
                  </p>
                `).join('')}
              </div>
            </div>
          `).join('');
          
          let countText = `✓ พบ <strong class="text-blue-600">${parsedMCQuestions.length}</strong> ข้อสอบปรนัย`;
          if (parsedMCQuestions.length > previewLimit) {
            countText += ` (แสดง ${previewLimit} ข้อแรก)`;
          }
          document.getElementById('mc-preview-count').innerHTML = countText;
          
          showAlert('success', 'แปลงสำเร็จ', `พบข้อสอบปรนัย ${parsedMCQuestions.length} ข้อ`);
        } else {
          showAlert('error', 'แปลงไม่สำเร็จ', 'ไม่พบข้อสอบที่ถูกต้องตามรูปแบบ');
        }
      }, 300);
    }

    function parseEssay() {
      const input = document.getElementById('essay-input').value.trim();
      if (!input) {
        showAlert('warning', 'ไม่มีข้อมูล', 'กรุณาวางข้อสอบก่อน');
        return;
      }

      const btn = event.target;
      setButtonLoading(btn, true, 'กำลังแปลง...');

      setTimeout(() => {
        const questionBlocks = input.split(/\n(?=\d+[\.\、\)])/);
        parsedEssayQuestions = [];

        questionBlocks.forEach((block, idx) => {
          const lines = block.trim().split('\n');
          if (lines.length < 1) return;

          const questionMatch = lines[0].match(/^\d+[\.\、\)]\s*(.*)/);
          if (!questionMatch) return;

          const question = questionMatch[1].trim();
          let maxScore = 0;

          for (let i = 1; i < lines.length; i++) {
            const scoreMatch = lines[i].match(/(?:คะแนน|Score|points|分數|分数|得分):\s*(\d+(?:\.\d+)?)/i);
            if (scoreMatch) {
              maxScore = parseFloat(scoreMatch[1]);
              break;
            }
          }

          if (question) {
            parsedEssayQuestions.push({ 
              id: 'essay_' + generateId() + '_' + idx,
              question, 
              maxScore: maxScore || 1 
            });
          }
        });

        setButtonLoading(btn, false);

        if (parsedEssayQuestions.length > 0) {
          document.getElementById('essay-preview').classList.remove('hidden');
          const previewLimit = 3;
          document.getElementById('essay-preview-content').innerHTML = parsedEssayQuestions.slice(0, previewLimit).map((q, i) => `
            <div class="border-2 border-orange-300 rounded-lg p-4 bg-gradient-to-br from-white to-orange-50 hover:shadow-lg transition">
              <div class="flex items-start justify-between mb-3">
                <p class="font-bold text-gray-900 flex-1"><span class="text-orange-600 bg-orange-100 px-2 py-1 rounded">ข้อที่ ${i + 1}</span> ${q.question}</p>
                <span class="badge badge-warning ml-2 whitespace-nowrap"><i class="fas fa-star mr-1"></i>${q.maxScore} คะแนน</span>
              </div>
              <div class="bg-gradient-to-r from-orange-50 to-amber-50 rounded p-3 text-gray-600 text-sm border-l-4 border-orange-400">
                <i class="fas fa-pen-nib mr-2 text-orange-500"></i> <strong>พื้นที่สำหรับตอบอัตนัย</strong>
              </div>
            </div>
          `).join('');
          
          let countText = `✓ พบ <strong class="text-orange-600">${parsedEssayQuestions.length}</strong> ข้อสอบอัตนัย`;
          if (parsedEssayQuestions.length > previewLimit) {
            countText += ` (แสดง ${previewLimit} ข้อแรก)`;
          }
          document.getElementById('essay-preview-count').innerHTML = countText;
          
          showAlert('success', 'แปลงสำเร็จ', `พบข้อสอบอัตนัย ${parsedEssayQuestions.length} ข้อ`);
        } else {
          showAlert('error', 'แปลงไม่สำเร็จ', 'ไม่พบข้อสอบอัตนัยที่ถูกต้องตามรูปแบบ');
        }
      }, 300);
    }

    function clearInput(inputId) {
      document.getElementById(inputId).value = '';
      if (inputId === 'mc-input') {
        parsedMCQuestions = [];
        document.getElementById('mc-preview').classList.add('hidden');
      } else {
        parsedEssayQuestions = [];
        document.getElementById('essay-preview').classList.add('hidden');
      }
    }

    function editMCQuestions() {
      showActionConfirm({
        title: 'ยืนยันการแก้ไขข้อสอบปรนัย',
        message: `คุณต้องการดึงข้อสอบปรนัยจำนวน ${parsedMCQuestions.length} ข้อกลับมาใส่ช่องข้อความเพื่อแก้ไข ใช่หรือไม่?`,
        icon: 'fa-file-pen',
        iconColor: 'text-blue-600',
        iconBg: 'bg-blue-100',
        confirmText: 'ดึงกลับมาแก้ไข',
        confirmClass: 'bg-blue-600 hover:bg-blue-700 text-white',
        onConfirm: () => {
          let textContent = '';
          parsedMCQuestions.forEach((q, index) => {
            textContent += `${index + 1}.${q.question}\n`;
            q.choices.forEach(c => {
              textContent += `${c.key}.${c.text}\n`;
            });
            textContent += `เฉลย: ${q.answer}.\n`;
            textContent += `คะแนน: ${q.score}\n\n`;
          });
          document.getElementById('mc-input').value = textContent.trim();
          document.getElementById('mc-preview').classList.add('hidden');
          document.getElementById('mc-edit-message').classList.remove('hidden');
          document.getElementById('mc-input').focus();
          document.getElementById('mc-input').scrollIntoView({ behavior: 'smooth' });
        }
      });
    }

    function clearMCPreview() {
      const count = parsedMCQuestions.length;
      showConfirmDelete(`คุณต้องการลบข้อสอบปรนัยทั้งหมดจำนวน ${count} ข้อใช่หรือไม่?`, () => {
        parsedMCQuestions = [];
        document.getElementById('mc-input').value = '';
        document.getElementById('mc-preview').classList.add('hidden');
        showAlert('success', 'สำเร็จ', 'ลบข้อสอบปรนัยทั้งหมดแล้ว');
      });
    }

    function editEssayQuestions() {
      showActionConfirm({
        title: 'ยืนยันการแก้ไขข้อสอบอัตนัย',
        message: `คุณต้องการดึงข้อสอบอัตนัยจำนวน ${parsedEssayQuestions.length} ข้อกลับมาใส่ช่องข้อความเพื่อแก้ไข ใช่หรือไม่?`,
        icon: 'fa-file-pen',
        iconColor: 'text-orange-600',
        iconBg: 'bg-orange-100',
        confirmText: 'ดึงกลับมาแก้ไข',
        confirmClass: 'bg-orange-600 hover:bg-orange-700 text-white',
        onConfirm: () => {
          let textContent = '';
          parsedEssayQuestions.forEach((q, index) => {
            textContent += `${index + 1}.${q.question}\n`;
            textContent += `คะแนน: ${q.maxScore}\n\n`;
          });
          document.getElementById('essay-input').value = textContent.trim();
          document.getElementById('essay-preview').classList.add('hidden');
          document.getElementById('essay-edit-message').classList.remove('hidden');
          document.getElementById('essay-input').focus();
          document.getElementById('essay-input').scrollIntoView({ behavior: 'smooth' });
        }
      });
    }

    function clearEssayPreview() {
      const count = parsedEssayQuestions.length;
      showConfirmDelete(`คุณต้องการลบข้อสอบอัตนัยทั้งหมดจำนวน ${count} ข้อใช่หรือไม่?`, () => {
        parsedEssayQuestions = [];
        document.getElementById('essay-input').value = '';
        document.getElementById('essay-preview').classList.add('hidden');
        showAlert('success', 'สำเร็จ', 'ลบข้อสอบอัตนัยทั้งหมดแล้ว');
      });
    }

    function resetExamForm() {
      document.getElementById('create-exam-form').reset();
      parsedMCQuestions = [];
      parsedEssayQuestions = [];
      document.getElementById('mc-preview').classList.add('hidden');
      document.getElementById('essay-preview').classList.add('hidden');
      document.getElementById('mc-edit-message').classList.add('hidden');
      document.getElementById('essay-edit-message').classList.add('hidden');
      document.getElementById('edit-exam-id').value = '';
    }

    document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      setButtonLoading(btn, true, 'กำลังเข้าสู่ระบบ...');

      setTimeout(async () => {
        const username = document.getElementById('admin-username').value;
        const password = document.getElementById('admin-password').value;
        await handleLogin(username, password);
        setButtonLoading(btn, false);
      }, 300);
    });

    document.getElementById('admin-register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      setButtonLoading(btn, true, 'กำลังสมัครสมาชิก...');

      setTimeout(async () => {
        const members = getMembers();
        if (members.length >= 999) {
          setButtonLoading(btn, false);
          showAlert('warning', 'ถึงขีดจำกัด', 'ไม่สามารถเพิ่มสมาชิกได้อีก');
          return;
        }

        const username = document.getElementById('reg-username').value;
        if (members.find(m => m.username === username)) {
          setButtonLoading(btn, false);
          showAlert('error', 'ผิดพลาด', 'ชื่อผู้ใช้นี้มีอยู่แล้ว');
          return;
        }

        const isFirstMember = members.length === 0;
        const newMember = {
          id: generateId(),
          type: 'member',
          username: username,
          password: document.getElementById('reg-password').value,
          fullname: document.getElementById('reg-fullname').value,
          email: document.getElementById('reg-email').value,
          role: isFirstMember ? 'admin' : 'teacher',
          status: isFirstMember ? 'active' : 'pending',
          created_at: new Date().toISOString()
        };

        const result = await window.dataSdk.create(newMember);
        setButtonLoading(btn, false);
        
        if (result.isOk) {
          hideModal('admin-register-modal');
          logActivity(`สมัครสมาชิกใหม่: ${username} (${newMember.fullname})`);
          if (isFirstMember) {
            showAlert('success', 'สมัครสำเร็จ', 'คุณเป็นผู้ดูแลระบบหลัก สามารถเข้าสู่ระบบได้เลย');
          } else {
            showAlert('success', 'สมัครสำเร็จ', 'กรุณารอการอนุมัติจากผู้ดูแลระบบ');
          }
          showModal('admin-login-modal');
        } else {
          showAlert('error', 'ผิดพลาด', 'ไม่สามารถสมัครสมาชิกได้');
        }
      }, 300);
    });

    document.getElementById('add-member-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullname = document.getElementById('member-fullname').value.trim();
      const username = document.getElementById('member-username').value.trim();
      const role = document.getElementById('member-role').value === 'admin' ? 'ผู้ดูแลระบบ' : 'ครู';

      showActionConfirm({
        title: 'ยืนยันการเพิ่มสมาชิก',
        message: `คุณต้องการเพิ่มสมาชิก "${fullname}" (ชื่อผู้ใช้: ${username}, บทบาท: ${role}) ใช่หรือไม่?`,
        icon: 'fa-user-plus',
        iconColor: 'text-primary-600',
        iconBg: 'bg-primary-100',
        confirmText: 'บันทึกสมาชิก',
        confirmClass: 'bg-primary-600 hover:bg-primary-700 text-white',
        onConfirm: async () => {
          const btn = e.target.querySelector('button[type="submit"]');
          setButtonLoading(btn, true, 'กำลังเพิ่มสมาชิก...');

          const members = getMembers();
          const mainAdmin = members.find(m => m.role === 'admin');
          
          if (!currentUser || !mainAdmin || currentUser.__backendId !== mainAdmin.__backendId) {
            setButtonLoading(btn, false);
            showAlert('error', 'ไม่มีสิทธิ์', 'เฉพาะผู้ดูแลระบบหลักเท่านั้นที่สามารถเพิ่มสมาชิกได้');
            hideModal('add-member-modal');
            return;
          }

          if (members.length >= 999) {
            setButtonLoading(btn, false);
            showAlert('warning', 'ถึงขีดจำกัด', 'ไม่สามารถเพิ่มสมาชิกได้อีก');
            return;
          }

          if (members.find(m => m.username === username)) {
            setButtonLoading(btn, false);
            showAlert('error', 'ผิดพลาด', 'ชื่อผู้ใช้นี้มีอยู่แล้ว');
            return;
          }

          const newMember = {
            id: generateId(),
            type: 'member',
            username: username,
            password: document.getElementById('member-password').value,
            fullname: fullname,
            email: document.getElementById('member-email').value,
            role: document.getElementById('member-role').value,
            status: 'active',
            created_at: new Date().toISOString()
          };

          const result = await window.dataSdk.create(newMember);
          setButtonLoading(btn, false);
          
          if (result.isOk) {
            hideModal('add-member-modal');
            logActivity(`เพิ่มสมาชิกใหม่: ${username}`);
            showAlert('success', 'สำเร็จ', `เพิ่มสมาชิก "${fullname}" เรียบร้อยแล้ว`);
            e.target.reset();
          } else {
            showAlert('error', 'ผิดพลาด', 'ไม่สามารถเพิ่มสมาชิกได้');
          }
        }
      });
    });

    document.getElementById('edit-member-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const backendId = document.getElementById('edit-member-id').value;
      const member = appData.find(d => d.__backendId === backendId);
      if (!member) return;

      const newFullname = document.getElementById('edit-member-fullname').value.trim();
      const newUsername = document.getElementById('edit-member-username').value.trim();

      showActionConfirm({
        title: 'ยืนยันการแก้ไขข้อมูลสมาชิก',
        message: `คุณต้องการบันทึกการแก้ไขข้อมูลของสมาชิก "${newFullname}" (${newUsername}) ใช่หรือไม่?`,
        icon: 'fa-user-pen',
        iconColor: 'text-primary-600',
        iconBg: 'bg-primary-100',
        confirmText: 'บันทึกการแก้ไข',
        confirmClass: 'bg-primary-600 hover:bg-primary-700 text-white',
        onConfirm: async () => {
          const btn = e.target.querySelector('button[type="submit"]');
          setButtonLoading(btn, true, 'กำลังบันทึก...');

          const newPassword = document.getElementById('edit-member-password').value;
          const updatedMember = {
            ...member,
            username: newUsername,
            fullname: newFullname,
            email: document.getElementById('edit-member-email').value,
            status: document.getElementById('edit-member-status').value,
            role: document.getElementById('edit-member-role').value
          };

          if (newPassword && newPassword.trim().length > 0) {
            updatedMember.password = newPassword;
          }

          const result = await window.dataSdk.update(updatedMember);
          setButtonLoading(btn, false);
          
          if (result.isOk) {
            hideModal('edit-member-modal');
            document.getElementById('edit-member-password').value = '';
            logActivity(`แก้ไขข้อมูลสมาชิก: ${updatedMember.username}`);
            showAlert('success', 'สำเร็จ', `แก้ไขข้อมูลสมาชิก "${updatedMember.fullname}" เรียบร้อยแล้ว`);
          } else {
            showAlert('error', 'ผิดพลาด', 'ไม่สามารถแก้ไขข้อมูลได้');
          }
        }
      });
    });

    document.getElementById('create-exam-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (parsedMCQuestions.length === 0 && parsedEssayQuestions.length === 0) {
        showAlert('warning', 'ไม่มีข้อสอบ', 'กรุณาแปลงข้อสอบก่อนบันทึก');
        return;
      }

      const editExamId = document.getElementById('edit-exam-id').value;
      const subjectName = document.getElementById('exam-subject-name').value.trim();
      const totalScoreVal = parseFloat(document.getElementById('exam-total-score').value);
      const totalQCount = parsedMCQuestions.length + parsedEssayQuestions.length;

      const actionText = editExamId ? 'แก้ไขข้อสอบ' : 'สร้างข้อสอบใหม่';
      const promptMsg = editExamId 
        ? `คุณต้องการบันทึกการแก้ไขข้อสอบวิชา "${subjectName}" (รวม ${totalQCount} ข้อ, คะแนนเต็ม ${totalScoreVal}) ใช่หรือไม่?`
        : `คุณต้องการบันทึกข้อสอบใหม่วิชา "${subjectName}" (รวม ${totalQCount} ข้อ, คะแนนเต็ม ${totalScoreVal}) ใช่หรือไม่?`;

      showActionConfirm({
        title: `ยืนยันการ${actionText}`,
        message: promptMsg,
        icon: 'fa-file-circle-check',
        iconColor: 'text-emerald-600',
        iconBg: 'bg-emerald-100',
        confirmText: 'บันทึกข้อสอบ',
        confirmClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        onConfirm: async () => {
          const submitBtn = e.target.querySelector('button[type="submit"]');
          setButtonLoading(submitBtn, true, 'กำลังบันทึก...');

          const passingScoreVal = parseFloat(document.getElementById('exam-passing-score').value);

          if (editExamId) {
            const exam = appData.find(d => d.__backendId === editExamId);
            if (!exam) {
              showAlert('error', 'ผิดพลาด', 'ไม่พบข้อสอบที่ต้องแก้ไข');
              setButtonLoading(submitBtn, false);
              return;
            }

            const updatedExam = {
              ...exam,
              subject_name: subjectName,
              total_score: totalScoreVal,
              passing_score: passingScoreVal,
              time_limit: parseInt(document.getElementById('exam-time-limit').value),
              score_per_question: parseFloat(document.getElementById('exam-score-per-question').value),
              is_visible: document.getElementById('exam-visible').checked,
              show_answer: document.getElementById('exam-show-answer').checked,
              shuffle_questions: document.getElementById('exam-shuffle-questions').checked,
              shuffle_choices: document.getElementById('exam-shuffle-choices').checked,
              questions: JSON.stringify({ mc: parsedMCQuestions, essay: parsedEssayQuestions })
            };

            const result = await window.dataSdk.update(updatedExam);
            if (result.isOk) {
              logActivity(`แก้ไขชุดข้อสอบวิชา: ${subjectName}`);
              showAlert('success', 'สำเร็จ', `อัปเดตข้อสอบวิชา "${subjectName}" เรียบร้อยแล้ว`);
              resetExamForm();
              document.getElementById('edit-exam-id').value = '';
            } else {
              showAlert('error', 'ผิดพลาด', 'ไม่สามารถอัปเดตข้อสอบได้');
            }
          } else {
            const exams = getExams();
            if (exams.length >= 999) {
              showAlert('warning', 'ถึงขีดจำกัด', 'ไม่สามารถเพิ่มข้อสอบได้อีก');
              setButtonLoading(submitBtn, false);
              return;
            }

            const newExam = {
              id: generateId(),
              type: 'exam',
              member_id: currentUser.__backendId,
              subject_name: subjectName,
              total_score: totalScoreVal,
              passing_score: passingScoreVal,
              time_limit: parseInt(document.getElementById('exam-time-limit').value),
              score_per_question: parseFloat(document.getElementById('exam-score-per-question').value),
              is_visible: document.getElementById('exam-visible').checked,
              show_answer: document.getElementById('exam-show-answer').checked,
              shuffle_questions: document.getElementById('exam-shuffle-questions').checked,
              shuffle_choices: document.getElementById('exam-shuffle-choices').checked,
              questions: JSON.stringify({ mc: parsedMCQuestions, essay: parsedEssayQuestions }),
              created_at: new Date().toISOString()
            };

            const result = await window.dataSdk.create(newExam);
            if (result.isOk) {
              logActivity(`สร้างชุดข้อสอบใหม่วิชา: ${subjectName}`);
              showAlert('success', 'สำเร็จ', `บันทึกข้อสอบวิชา "${subjectName}" เรียบร้อยแล้ว`);
              resetExamForm();
            } else {
              showAlert('error', 'ผิดพลาด', 'ไม่สามารถบันทึกข้อสอบได้');
            }
          }

          setButtonLoading(submitBtn, false);
        }
      });
    });

    document.getElementById('announcement-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser || currentUser.role !== 'admin') {
        showAlert('error', 'ปฏิเสธคำสั่ง', 'คุณไม่มีสิทธิ์ในการจัดการประกาศ');
        return;
      }

      const editId = document.getElementById('announcement-edit-id').value;
      const title = document.getElementById('announcement-title').value.trim();
      const level = document.getElementById('announcement-level').value;
      const content = document.getElementById('announcement-content').value.trim();
      const isActive = document.getElementById('announcement-active').checked;

      showActionConfirm({
        title: editId ? 'ยืนยันการบันทึกการแก้ไขประกาศ' : 'ยืนยันการบันทึกประกาศใหม่',
        message: `คุณต้องการบันทึก${editId ? 'การแก้ไข' : ''}ประกาศหัวข้อ "${title}" ใช่หรือไม่?`,
        icon: 'fa-bullhorn',
        iconColor: 'text-primary-600',
        iconBg: 'bg-primary-100',
        confirmText: 'บันทึกประกาศ',
        confirmClass: 'bg-primary-600 hover:bg-primary-700 text-white',
        onConfirm: async () => {
          const btn = e.target.querySelector('button[type="submit"]');
          setButtonLoading(btn, true, 'กำลังบันทึก...');

          if (editId) {
            const item = appData.find(d => d.__backendId === editId);
            if (item) {
              const updated = {
                ...item,
                title,
                level,
                content,
                is_active: isActive
              };
              const res = await window.dataSdk.update(updated);
              setButtonLoading(btn, false);
              if (res.isOk) {
                hideModal('announcement-modal');
                logActivity(`แก้ไขประกาศ: ${title}`);
                showAlert('success', 'สำเร็จ', `อัปเดตประกาศ "${title}" เรียบร้อยแล้ว`);
              }
            }
          } else {
            const newItem = {
              id: generateId(),
              type: 'announcement',
              title,
              level,
              content,
              is_active: isActive,
              created_by: currentUser.fullname,
              created_at: new Date().toISOString()
            };
            const res = await window.dataSdk.create(newItem);
            setButtonLoading(btn, false);
            if (res.isOk) {
              hideModal('announcement-modal');
              logActivity(`สร้างประกาศใหม่: ${title}`);
              showAlert('success', 'สำเร็จ', `สร้างประกาศหัวข้อ "${title}" เรียบร้อยแล้ว`);
            }
          }
        }
      });
    });

    document.getElementById('proctor-message-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const targetId = document.getElementById('proctor-msg-target-id').value;
      const targetName = document.getElementById('proctor-msg-target-name').textContent;
      const text = document.getElementById('proctor-msg-text').value.trim();

      showActionConfirm({
        title: 'ยืนยันการส่งข้อความเตือน',
        message: `คุณต้องการส่งข้อความเตือนไปยัง ${targetName}\nด้วยข้อความ: "${text}" ใช่หรือไม่?`,
        icon: 'fa-paper-plane',
        iconColor: 'text-primary-600',
        iconBg: 'bg-primary-100',
        confirmText: 'ส่งข้อความเตือน',
        confirmClass: 'bg-primary-600 hover:bg-primary-700 text-white',
        onConfirm: async () => {
          const btn = e.target.querySelector('button[type="submit"]');
          setButtonLoading(btn, true, 'กำลังส่ง...');
          const subjectId = document.getElementById('proctor-msg-subject-id').value;

          const newMsg = {
            id: generateId(),
            type: 'proctor_msg',
            target_student_id: targetId,
            subject_id: subjectId,
            message: text,
            sender_name: currentUser ? currentUser.fullname : 'ผู้คุมสอบ',
            created_at: new Date().toISOString()
          };

          const res = await window.dataSdk.create(newMsg);
          setButtonLoading(btn, false);
          if (res.isOk) {
            hideModal('proctor-message-modal');
            logActivity(`ส่งข้อความเตือนถึงนักเรียนรหัส ${targetId}: "${text}"`);
            showAlert('success', 'ส่งแล้ว', `ส่งข้อความเตือนไปยัง ${targetName} เรียบร้อยแล้ว`);
          }
        }
      });
    });

    document.getElementById('broadcast-message-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const subjectId = document.getElementById('proctor-subject-select').value;
      const exam = appData.find(e => e.id === subjectId && e.type === 'exam');
      const subjectName = exam ? exam.subject_name : '-';
      const text = document.getElementById('broadcast-msg-text').value.trim();

      showActionConfirm({
        title: 'ยืนยันการแจ้งเตือนทุกคน',
        message: `คุณต้องการส่งประกาศแจ้งเตือนนักเรียนทุกคนในวิชา "${subjectName}"\nด้วยข้อความ: "${text}" ใช่หรือไม่?`,
        icon: 'fa-bullhorn',
        iconColor: 'text-primary-600',
        iconBg: 'bg-primary-100',
        confirmText: 'ประกาศเตือนทุกคน',
        confirmClass: 'bg-primary-600 hover:bg-primary-700 text-white',
        onConfirm: async () => {
          const btn = e.target.querySelector('button[type="submit"]');
          setButtonLoading(btn, true, 'กำลังส่ง...');

          const newMsg = {
            id: generateId(),
            type: 'proctor_msg',
            target_student_id: 'ALL',
            subject_id: subjectId,
            message: text,
            sender_name: currentUser ? currentUser.fullname : 'ผู้คุมสอบ',
            created_at: new Date().toISOString()
          };

          const res = await window.dataSdk.create(newMsg);
          setButtonLoading(btn, false);
          if (res.isOk) {
            hideModal('broadcast-message-modal');
            logActivity(`ส่งข้อความประกาศเตือนทุกคนในห้องสอบวิชา ${subjectName}: "${text}"`);
            showAlert('success', 'กระจายเสียงสำเร็จ', 'ส่งข้อความเตือนไปยังนักเรียนทุกคนในห้องสอบแล้ว');
          }
        }
      });
    });

    const userProfileForm = document.getElementById('profile-form');
    if (userProfileForm) {
      userProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullname = document.getElementById('profile-fullname').value.trim();
        const email = document.getElementById('profile-email').value.trim();

        showActionConfirm({
          title: 'ยืนยันการแก้ไขข้อมูลส่วนตัว',
          message: `คุณต้องการบันทึกการเปลี่ยนแปลงข้อมูลส่วนตัวของ "${fullname}" ใช่หรือไม่?`,
          icon: 'fa-user-check',
          iconColor: 'text-primary-600',
          iconBg: 'bg-primary-100',
          confirmText: 'บันทึกข้อมูล',
          confirmClass: 'bg-primary-600 hover:bg-primary-700 text-white',
          onConfirm: async () => {
            const btn = e.target.querySelector('button[type="submit"]');
            setButtonLoading(btn, true, 'กำลังบันทึก...');

            if (!currentUser) {
              setButtonLoading(btn, false);
              return;
            }

            const newPassword = document.getElementById('profile-password').value;
            const updatedUser = {
              ...currentUser,
              fullname: fullname,
              email: email
            };

            if (newPassword) {
              updatedUser.password = newPassword;
            }

            const result = await window.dataSdk.updateProfile({ fullname, email, password: newPassword || '' });
            setButtonLoading(btn, false);
            
            if (result.isOk) {
              currentUser = result.data || { ...currentUser, fullname, email };
              document.getElementById('admin-name').textContent = updatedUser.fullname;
              logActivity(`แก้ไขโปรไฟล์ส่วนตัว: ${updatedUser.fullname}`);
              showAlert('success', 'สำเร็จ', 'บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
            } else {
              showAlert('error', 'ผิดพลาด', 'ไม่สามารถบันทึกได้');
            }
          }
        });
      });
    }

    document.getElementById('student-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      setButtonLoading(btn, true, 'กำลังเข้าสู่ระบบสอบ...');

      try {
        const subjectId = document.getElementById('subject-select').value;
        const studentIdVal = document.getElementById('student-id').value.trim();
        const fullnameVal = document.getElementById('student-name').value.trim();
        const classVal = document.getElementById('student-class').value;
        const roomVal = document.getElementById('student-room').value;
        const numberVal = document.getElementById('student-number').value;

        if (!subjectId || !studentIdVal || !fullnameVal || !classVal || !roomVal || !numberVal) {
          throw new Error('Invalid data');
        }

        const sessionKey = `exam_session_${studentIdVal}_${subjectId}`;
        let localSessionToken = sessionStorage.getItem(sessionKey) || '';

        const result = await window.dataSdk.startStudent({
          id: generateId(),
          type: 'student',
          student_id: studentIdVal,
          fullname: fullnameVal,
          class_name: classVal,
          room: roomVal,
          number: numberVal,
          subject_id: subjectId,
          session_token: localSessionToken
        });

        if (!result.isOk) {
          throw result.error || new Error('เข้าสอบไม่ได้');
        }

        currentStudentSessionToken = String(result.data.session_token || localSessionToken || '');
        if (!currentStudentSessionToken) throw new Error('Invalid exam session');
        sessionStorage.setItem(sessionKey, currentStudentSessionToken);
        sessionStorage.setItem('dm_exam_student_token', currentStudentSessionToken);

        const secureExam = await window.dataSdk._callAPI('getExamForStudent', {
          student_id: studentIdVal,
          subject_id: subjectId,
          session_token: currentStudentSessionToken
        });

        currentExam = secureExam;
        const student = result.data.student || result.data;
        document.getElementById('exam-student-info').textContent =
          `${student.student_id} ${student.fullname} ${student.class_name}/${student.room} เลขที่ ${student.number}`;
        document.getElementById('exam-subject-info').textContent = secureExam.subject_name;

        const serverLeft = Math.max(0, Number(secureExam.remaining_seconds || 0));
        examTimeLeft = serverLeft || (Number(secureExam.time_limit || 0) * 60);
        warningCount = Number(student.warnings || 0);
        isStudentDisqualified = !!student.is_disqualified;
        studentAnswers = { mc: {}, essay: {} };
        currentQuestionIndex = 0;

        const rawQuestions = (typeof currentExam.questions === 'string') ? JSON.parse(currentExam.questions) : currentExam.questions;
        const questions = {
          mc: (rawQuestions.mc || []).map((q, i) => ({ ...q, id: q.id || `mc_${i}` })),
          essay: (rawQuestions.essay || []).map((q, i) => ({ ...q, id: q.id || `essay_${i}` }))
        };

        if (secureExam.shuffle_questions) {
          questions.mc = shuffleArray([...questions.mc]);
          questions.essay = shuffleArray([...questions.essay]);
        }
        currentExam.parsedQuestions = questions;

        setButtonLoading(btn, false);
        showPage('exam');
        generateWatermarks(student, currentExam.subject_name);
        startExamTimer();
        renderQuestion();
        setupExamProtection();
        startStudentProctorSync(student.student_id, currentExam.id);
        logActivity(`นักเรียน ${student.student_id} (${student.fullname}) เริ่มทำสอบวิชา ${currentExam.subject_name}`);
      } catch (err) {
        setButtonLoading(btn, false);
        const msg = String(err && err.message || '');
        if (msg.includes('another device')) {
          showAlert('error', 'จำกัด 1 อุปกรณ์', 'รหัสนักเรียนนี้กำลังทำข้อสอบบนอุปกรณ์อื่นอยู่แล้ว (อนุญาตให้เข้าสอบได้เพียง 1 อุปกรณ์เท่านั้น)');
        } else if (msg.includes('already submitted')) {
          showAlert('error', 'เข้าสอบไม่ได้', 'คุณได้ส่งข้อสอบวิชานี้เรียบร้อยแล้ว ไม่สามารถเข้าสอบซ้ำได้');
        } else if (msg.includes('not available')) {
          showAlert('error', 'เข้าสอบไม่ได้', 'รายวิชานี้ยังไม่เปิดให้เข้าสอบ');
        } else {
          showAlert('error', 'เข้าสู่ระบบสอบไม่สำเร็จ', 'ไม่สามารถเข้าสู่ระบบสอบได้ กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง');
        }
      }
    });

    function updateWatermarksText(student, subjectName) {
      const container = document.getElementById('exam-watermark');
      if (!container) return;
      
      const now = new Date();
      const dateStr = now.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      const localIpDisplay = clientLocalIp || '127.0.0.1 (Local)';
      const publicIpDisplay = clientPublicIp || 'กำลังตรวจจับ...';

      const watermarkHtml = `
        <div class="leading-tight text-center pointer-events-none select-none">
          <div class="font-extrabold text-[15px] text-slate-900 tracking-tight whitespace-nowrap">
            ${student.student_id} ${student.fullname}
          </div>
          <div class="text-[14px] font-semibold text-slate-700 whitespace-nowrap mt-0.5">
            ${student.class_name}/${student.room} #${student.number}
          </div>
          <div class="text-[14px] font-semibold text-slate-700 whitespace-nowrap mt-0.5">
            ${subjectName}
          </div>
          <div class="text-[14px] font-sarabun text-slate-600 font-bold tracking-tight whitespace-nowrap mt-0.5">
            IP : ${localIpDisplay}
          </div>
          <div class="text-[14px] font-sarabun text-slate-600 font-bold tracking-tight whitespace-nowrap mt-0.5">
            IP : ${publicIpDisplay}
          </div>
          <div class="text-[14px] font-sarabun text-slate-600 font-bold tracking-tight whitespace-nowrap mt-0.5">
            ${dateStr} ${timeStr}
          </div>
        </div>
      `;
      
      const existingItems = container.querySelectorAll('.watermark-item');
      if (existingItems.length === 0) {
        let html = '';
        for (let i = 0; i < 48; i++) {
          html += `<div class="watermark-item">${watermarkHtml}</div>`;
        }
        container.innerHTML = html;
      } else {
        existingItems.forEach(item => {
          item.innerHTML = watermarkHtml;
        });
      }
    }

    function generateWatermarks(student, subjectName) {
      if (watermarkTimer) clearInterval(watermarkTimer);
      updateWatermarksText(student, subjectName);
      watermarkTimer = setInterval(() => {
        if (document.getElementById('page-exam').classList.contains('hidden')) {
          clearInterval(watermarkTimer);
          return;
        }
        updateWatermarksText(student, subjectName);
      }, 1000);
    }

    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    function startExamTimer() {
      updateTimerDisplay();
      examTimer = setInterval(() => {
        examTimeLeft--;
        updateTimerDisplay();
        if (examTimeLeft <= 0) {
          clearInterval(examTimer);
          submitExam();
        }
      }, 1000);
    }

    function updateTimerDisplay() {
      const hours = Math.floor(examTimeLeft / 3600);
      const minutes = Math.floor((examTimeLeft % 3600) / 60);
      const seconds = examTimeLeft % 60;
      document.getElementById('exam-timer').textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      if (examTimeLeft <= 300) {
        document.getElementById('exam-timer').classList.add('text-red-300');
      }
    }

    function renderQuestion() {
      const questions = currentExam.parsedQuestions;
      const allQuestions = [...questions.mc.map((q, i) => ({ ...q, type: 'mc', displayIndex: i })),
                            ...questions.essay.map((q, i) => ({ ...q, type: 'essay', displayIndex: i }))];
      
      const totalQuestions = allQuestions.length;
      document.getElementById('exam-progress-text').textContent = `${currentQuestionIndex + 1}/${totalQuestions} ข้อ`;
      document.getElementById('exam-progress-bar').style.width = `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`;
      document.getElementById('exam-warning-count').textContent = `คำเตือน: ${warningCount}/3`;

      const q = allQuestions[currentQuestionIndex];
      const container = document.getElementById('question-container');

      if (q.type === 'mc') {
        let displayChoices = [...q.choices];
        if (currentExam.shuffle_choices) {
          displayChoices = shuffleArray([...q.choices]);
        }
        
        let displayLabels = ['ก', 'ข', 'ค', 'ง', 'จ'];
        if (q.choices && q.choices.length > 0) {
          const firstKey = (q.choices[0].key || '').toString().trim();
          if (/^[A-Ea-e]/.test(firstKey)) {
            displayLabels = ['A', 'B', 'C', 'D', 'E'];
          } else if (/^[1-5]/.test(firstKey)) {
            displayLabels = ['1', '2', '3', '4', '5'];
          }
        }

        container.innerHTML = `
          <div class="fade-in">
            <div class="flex items-center gap-2 mb-4">
              <span class="badge badge-info">ปรนัย</span>
              <span class="text-gray-500">ข้อที่ ${currentQuestionIndex + 1}</span>
            </div>
            <h3 class="text-xl font-bold text-gray-800 mb-6">${q.question}</h3>
            <div class="space-y-3">
              ${displayChoices.map((choice, idx) => {
                const uiLabel = displayLabels[idx] || (idx + 1);
                const isChecked = studentAnswers.mc[q.id] === choice.key;
                return `
                  <label class="flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition
                    ${isChecked ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300'}">
                    <input type="radio" name="mc-answer" value="${choice.key}" 
                      ${isChecked ? 'checked' : ''}
                      onchange="selectMCAnswer('${q.id}', '${choice.key}')"
                      class="w-5 h-5 text-primary-500">
                    <span class="text-lg font-medium"><strong class="text-primary-600 mr-1">${uiLabel}.</strong> ${choice.text}</span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="fade-in">
            <div class="flex items-center gap-2 mb-4">
              <span class="badge badge-warning">อัตนัย</span>
              <span class="text-gray-500">ข้อที่ ${currentQuestionIndex + 1}</span>
            </div>
            <h3 class="text-xl font-bold text-gray-800 mb-6">${q.question}</h3>
            <textarea id="essay-answer" rows="8"
              class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none text-lg font-sarabun"
              placeholder="พิมพ์คำตอบของคุณที่นี่..."
              onchange="selectEssayAnswer('${q.id}', this.value)">${studentAnswers.essay[q.id] || ''}</textarea>
          </div>
        `;
      }

      document.getElementById('prev-btn').disabled = currentQuestionIndex === 0;
      document.getElementById('next-btn').innerHTML = currentQuestionIndex === totalQuestions - 1 
        ? '<i class="fas fa-flag-checkered"></i> สิ้นสุด' 
        : 'ข้อถัดไป <i class="fas fa-chevron-right"></i>';
      
      document.getElementById('submit-container').classList.toggle('hidden', currentQuestionIndex !== totalQuestions - 1);
    }

    window.selectMCAnswer = function(qId, choiceKey) {
      studentAnswers.mc[qId] = choiceKey;
      renderQuestion();
    };

    window.selectEssayAnswer = function(qId, value) {
      studentAnswers.essay[qId] = value;
    };

    function prevQuestion() {
      if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
      }
    }

    function nextQuestion() {
      const questions = currentExam.parsedQuestions;
      const totalQuestions = questions.mc.length + questions.essay.length;
      
      if (currentQuestionIndex < totalQuestions - 1) {
        currentQuestionIndex++;
        renderQuestion();
      }
    }

    function confirmSubmitExam() {
      if (!currentExam) return;
      showActionConfirm({
        title: 'ยืนยันการส่งคำตอบ',
        message: `คุณต้องการส่งคำตอบข้อสอบวิชา "${currentExam.subject_name}" ใช่หรือไม่?\n(เมื่อส่งแล้วจะไม่สามารถกลับมาแก้ไขคำตอบได้อีก)`,
        icon: 'fa-paper-plane',
        iconColor: 'text-emerald-600',
        iconBg: 'bg-emerald-100',
        confirmText: 'ยืนยันส่งคำตอบ',
        confirmClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        onConfirm: () => {
          submitExam();
        }
      });
    }

    async function submitExam() {
      if (examTimer) clearInterval(examTimer);
      if (studentSyncInterval) clearInterval(studentSyncInterval);

      const loadingOverlay = document.createElement('div');
      loadingOverlay.className = 'fixed inset-0 bg-white/100 z-50 flex items-center justify-center';
      loadingOverlay.innerHTML = `
        <div class="text-center">
          <i class="fas fa-circle-notch spin text-5xl text-primary-500 mb-4"></i>
          <p class="text-red-600 text-lg font-bold">โดนเขาหลอกยังไม่พอ...ยังโดนข้อสอบหลอกอีก</p>
        </div>
      `;
      document.body.appendChild(loadingOverlay);

      try {
        const result = await window.dataSdk.submitExam({
          student_id: document.getElementById('student-id').value.trim(),
          subject_id: currentExam && currentExam.id,
          session_token: currentStudentSessionToken,
          answers: studentAnswers
        });

        if (!result.isOk) throw result.error || new Error('Submit failed');

        const examResult = result.data;
        const questions = currentExam.parsedQuestions || { mc: [], essay: [] };
        const hasEssay = questions.essay.length > 0;
        const backendDisqualified = !!examResult.cheating_detected || Number(examResult.warnings || 0) >= 4;
        const reviewQuestions = examResult.__reviewQuestions || [];
        const passThreshold = Number(examResult.passing_score || 0);
        const mcScore = Number(examResult.mc_score || 0);

        logActivity(`นักเรียน ${examResult.student_id} (${examResult.fullname}) ส่งข้อสอบวิชา ${examResult.subject_name} (${backendDisqualified ? 'ถูกตัดสิทธิ์' : `คะแนนปรนัย: ${mcScore}/${examResult.total_score}`})`);
        const resultIcon = document.getElementById('result-icon');
        const resultTitle = document.getElementById('result-title');
        const resultMessage = document.getElementById('result-message');
        const isPassed = !backendDisqualified && Number(examResult.score || 0) >= passThreshold;

        if (backendDisqualified) {
          resultIcon.className = 'w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6';
          resultIcon.innerHTML = '<i class="fas fa-ban text-5xl text-red-500"></i>';
          resultTitle.textContent = 'ทุจริต/ถูกตัดสิทธิ์';
          resultTitle.className = 'text-3xl font-bold mb-2 text-red-600';
          resultMessage.textContent = 'ตรวจพบการทุจริตหรือถูกตัดสิทธิ์การสอบตามระเบียบการสอบ';
        } else if (isPassed) {
          resultIcon.className = 'w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6';
          resultIcon.innerHTML = '<i class="fas fa-trophy text-5xl text-green-500"></i>';
          resultTitle.textContent = 'ผ่านเกณฑ์การสอบ!';
          resultTitle.className = 'text-3xl font-bold mb-2 text-green-600';
          resultMessage.textContent = `คุณสอบผ่านเกณฑ์ (${passThreshold} คะแนนขึ้นไป)`;
        } else {
          resultIcon.className = 'w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6';
          resultIcon.innerHTML = '<i class="fas fa-book-reader text-5xl text-red-500"></i>';
          resultTitle.textContent = 'ไม่ผ่านเกณฑ์';
          resultTitle.className = 'text-3xl font-bold mb-2 text-red-600';
          resultMessage.textContent = `เกณฑ์ผ่านคือ ${passThreshold} คะแนน พยายามต่อไปนะ!`;
        }

        document.getElementById('result-score').textContent = backendDisqualified ? '0 (ทุจริต/ถูกตัดสิทธิ์)' : (hasEssay ? `${mcScore} (รอตรวจอัตนัย)` : examResult.score);
        document.getElementById('result-total').textContent = examResult.total_score;
        document.getElementById('result-info').innerHTML = `
          <p><strong>รหัสนักเรียน:</strong> ${examResult.student_id}</p>
          <p><strong>ชื่อ-สกุล:</strong> ${examResult.fullname}</p>
          <p><strong>ชั้น/ห้อง:</strong> ${examResult.class_name}/${examResult.room}</p>
          <p><strong>รายวิชา:</strong> ${examResult.subject_name}</p>
          <p><strong>เกณฑ์ผ่าน:</strong> ${passThreshold} คะแนน</p>
          <p><strong>เวลาส่ง:</strong> ${new Date(examResult.submitted_at).toLocaleString('th-TH')}</p>
          ${backendDisqualified ? '<p class="text-red-500 font-bold"><strong>⚠️ สถานะ:</strong> ตรวจพบการทุจริต/ถูกตัดสิทธิ์การสอบ (ไม่ได้รับคะแนนและไม่อนุญาตให้ดูเฉลย)</p>' : ''}
          ${hasEssay && !backendDisqualified ? '<p class="text-orange-500"><strong>หมายเหตุ:</strong> รอตรวจข้อสอบอัตนัยเพิ่มเติม</p>' : ''}
        `;
        displayAnswerReview(examResult, reviewQuestions, backendDisqualified);
        showPage('result');
      } catch (err) {
        const msg = String(err && err.message || '');
        if (msg.includes('already submitted')) {
          showAlert('error', 'ส่งข้อสอบไม่ได้', 'ข้อสอบนี้ถูกส่งไปแล้ว');
        } else if (msg.includes('Invalid exam session')) {
          showAlert('error', 'เซสชันหมดอายุ', 'ไม่สามารถส่งข้อสอบด้วยเซสชันนี้ได้ กรุณาติดต่อผู้คุมสอบ');
        } else {
          showAlert('error', 'ส่งข้อสอบไม่สำเร็จ', 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองอีกครั้ง');
        }
      } finally {
        if (loadingOverlay.parentNode) loadingOverlay.parentNode.removeChild(loadingOverlay);
      }
    }

    function resetExamState() {
      if (examTimer) clearInterval(examTimer);
      if (studentSyncInterval) clearInterval(studentSyncInterval);
      if (watermarkTimer) clearInterval(watermarkTimer);
      isStudentSyncing = false;
      isStudentDisqualified = false;
      currentExam = null;
      currentStudentSessionToken = '';
      sessionStorage.removeItem('dm_exam_student_token');
      currentQuestionIndex = 0;
      examTimeLeft = 0;
      studentAnswers = { mc: {}, essay: {} };
      warningCount = 0;
      seenMessageIds.clear();
      document.getElementById('student-form').reset();
      unblurExamView();
      const watermarkContainer = document.getElementById('exam-watermark');
      if (watermarkContainer) watermarkContainer.innerHTML = '';
    }

    function blurExamView() {
      if (document.getElementById('page-exam').classList.contains('hidden')) return;
      isExamBlurred = true;
      const mainContent = document.getElementById('exam-main-content');
      const headerContent = document.getElementById('exam-header-content');
      const overlay = document.getElementById('exam-focus-overlay');
      
      if (mainContent) mainContent.classList.add('exam-blurred');
      if (headerContent) headerContent.classList.add('exam-blurred');
      if (overlay) overlay.classList.remove('hidden');
    }

    function unblurExamView() {
      isExamBlurred = false;
      const mainContent = document.getElementById('exam-main-content');
      const headerContent = document.getElementById('exam-header-content');
      const overlay = document.getElementById('exam-focus-overlay');
      
      if (mainContent) mainContent.classList.remove('exam-blurred');
      if (headerContent) headerContent.classList.remove('exam-blurred');
      if (overlay) overlay.classList.add('hidden');
    }

    function resumeExamFocus() {
      unblurExamView();
      window.focus();
    }

    function acknowledgeExamWarning() {
      hideModal('warning-modal');
      unblurExamView();
      window.focus();
    }

    function setupExamProtection() {
      document.addEventListener('contextmenu', preventAction);
      document.addEventListener('copy', preventAction);
      document.addEventListener('paste', preventAction);
      document.addEventListener('cut', preventAction);
      document.addEventListener('dragstart', preventAction);
      document.addEventListener('drop', preventAction);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleWindowBlur);
      window.addEventListener('focus', handleWindowFocus);
      document.addEventListener('mouseleave', handleMouseLeave);
      window.addEventListener('pagehide', handlePageHide);
      window.addEventListener('keydown', handleSecurityKeys);
      window.addEventListener('keyup', handleSecurityKeysRelease);
      
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices.getDisplayMedia = function() {
          triggerFocusLoss('ตรวจพบความพยายามแชร์หน้าจอหรือบันทึกวิดีโอหน้าจอ');
          return Promise.reject(new Error('Screen recording is strictly prohibited'));
        };
      }
    }

    function handleSecurityKeysRelease(e) {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        clearClipboardData();
      }
    }

    function clearClipboardData() {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('');
        }
      } catch(err) {}
    }

    function handleSecurityKeys(e) {
      if (document.getElementById('page-exam').classList.contains('hidden')) return;

      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        clearClipboardData();
        triggerFocusLoss('ห้ามบันทึกภาพหน้าจอหรือใช้คำสั่ง PrintScreen');
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        triggerFocusLoss('ห้ามพิมพ์หรือบันทึกหน้าจอเป็น PDF');
        return;
      }

      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U' || e.key === 's' || e.key === 'S'))
      ) {
        e.preventDefault();
        triggerFocusLoss('ห้ามเปิด Developer Tools หรือบันทึกหน้าเว็บ');
        return;
      }

      if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S' || e.key === '3' || e.key === '4' || e.key === '5' || e.key === '6')) ||
        (e.altKey && (e.key === 'PrintScreen' || e.keyCode === 44)) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G'))
      ) {
        e.preventDefault();
        clearClipboardData();
        triggerFocusLoss('ตรวจพบการเรียกใช้เครื่องมือบันทึกภาพ/อัดวิดีโอหน้าจอ');
        return;
      }
    }

    function preventAction(e) {
      if (document.getElementById('page-exam').classList.contains('hidden')) return;
      e.preventDefault();
      triggerFocusLoss('ไม่อนุญาตให้คัดลอก ตัด หรือวางข้อความ');
    }

    function triggerFocusLoss(reasonText) {
      if (document.getElementById('page-exam').classList.contains('hidden')) return;

      blurExamView();

      const now = Date.now();
      if (now - lastFocusLossTime < 800) {
        return;
      }
      lastFocusLossTime = now;

      addWarning(reasonText);
    }

    function handleVisibilityChange() {
      if (document.getElementById('page-exam').classList.contains('hidden')) return;
      if (document.hidden) {
        triggerFocusLoss('ตรวจพบการสลับแท็บหรือออกจากหน้าจอทำข้อสอบ');
      }
    }

    function handleWindowBlur() {
      if (document.getElementById('page-exam').classList.contains('hidden')) return;
      triggerFocusLoss('ตรวจพบการหลุดโฟกัสหรือสลับออกจากหน้าต่างสอบ');
    }

    function handlePageHide() {
      if (document.getElementById('page-exam').classList.contains('hidden')) return;
      triggerFocusLoss('ตรวจพบการย่อหรือสลับแอปพลิเคชัน');
    }

    function handleWindowFocus() {
      if (document.getElementById('page-exam').classList.contains('hidden')) return;
    }

    function handleMouseLeave(e) {
      if (document.getElementById('page-exam').classList.contains('hidden')) return;
      if (e.clientY <= 0 || e.clientX <= 0 || (e.clientX >= window.innerWidth || e.clientY >= window.innerHeight)) {
        blurExamView();
      }
    }

    async function addWarning(message) {
      try {
        const result = await window.dataSdk.reportWarning({
          student_id: document.getElementById('student-id').value.trim(),
          subject_id: currentExam && currentExam.id,
          session_token: currentStudentSessionToken,
          reason: String(message || '').slice(0, 300)
        });

        warningCount = Number(result.warningCount || 0);
        isStudentDisqualified = !!result.is_disqualified;

        const warningBadge = document.getElementById('exam-warning-count');
        if (warningBadge) warningBadge.textContent = `คำเตือน: ${warningCount}/3`;
        const overlayText = document.getElementById('focus-overlay-warning-text');
        if (overlayText) overlayText.textContent = `คำเตือนครั้งที่ ${warningCount}/3 (หากครบ 4 ครั้งจะยุติการสอบทันที)`;

        if (isStudentDisqualified || warningCount >= 4) {
          unblurExamView();
          hideModal('warning-modal');
          showAlert('error', 'ยุติการสอบทันที', 'ตรวจพบการหลุดโฟกัสหรือทุจริตครบ 4 ครั้ง ระบบทำการส่งข้อสอบและยุติการสอบ');
          setTimeout(() => submitExam(), 1800);
        } else {
          showWarning(message);
        }
      } catch (err) {
        // ไม่เพิ่มคะแนน/คำเตือนจาก Client เมื่อ Server ปฏิเสธคำขอ
        showAlert('error', 'ไม่สามารถบันทึกคำเตือน', 'ไม่สามารถติดต่อระบบคุมสอบได้ กรุณารอสักครู่แล้วลองใหม่');
      }
    }

    function showWarning(message) {
      document.getElementById('warning-message').textContent = message;
      document.getElementById('warning-count').textContent = `คำเตือนครั้งที่ ${warningCount}/3 (หากตรวจพบครบ 4 ครั้งจะยุติการสอบทันที)`;
      showModal('warning-modal');
    }

    function displayAnswerReview(examResult, questions, isDisqualifiedParam = false) {
      const container = document.getElementById('answer-review-container');
      const blockedDiv = document.getElementById('answer-review-blocked');
      const allowedDiv = document.getElementById('answer-review-allowed');
      const contentDiv = document.getElementById('answer-review-content');
      
      const isCheatingOrDisqualified = isDisqualifiedParam || 
                                       isStudentDisqualified || 
                                       Boolean(examResult.cheating_detected) || 
                                       Number(examResult.warnings) >= 4;

      // กรณีตรวจพบการทุจริต หรือถูกตัดสิทธิ์การสอบ: บล็อกการดูเฉลยทันทีเด็ดขาด แม้ครูจะเปิดเฉลยไว้ก็ตาม
      if (isCheatingOrDisqualified) {
        if (contentDiv) contentDiv.innerHTML = ''; // ล้างข้อสอบและเฉลยออกจาก DOM ป้องกันการ Inspect
        if (allowedDiv) allowedDiv.classList.add('hidden');
        if (blockedDiv) {
          blockedDiv.classList.remove('hidden');
          blockedDiv.innerHTML = `
            <i class="fas fa-ban text-4xl text-red-500 mb-3 block animate-pulse"></i>
            <p class="text-red-700 font-bold text-lg">ระงับสิทธิ์การดูเฉลย</p>
            <p class="text-red-600 text-sm mt-2 font-medium">คุณถูกตัดสิทธิ์การสอบหรือตรวจพบการกระทำทุจริต ระบบจึงไม่อนุญาตให้ดูเฉลยคำตอบทุกกรณี</p>
          `;
        }
        if (container) container.classList.remove('hidden');
        return;
      }

      // ตรวจสอบว่าครูเปิดเฉลยวิชานี้ไว้หรือไม่
      const exam = appData.find(d => (d.id === examResult.subject_id || d.__backendId === examResult.subject_id) && d.type === 'exam') || currentExam;
      
      if (!exam || !exam.show_answer) {
        if (container) container.classList.add('hidden');
        return;
      }

      if (blockedDiv) blockedDiv.classList.add('hidden');
      if (allowedDiv) allowedDiv.classList.remove('hidden');
      if (container) container.classList.remove('hidden');

      const rawAnswers = (typeof examResult.answers === 'string') ? JSON.parse(examResult.answers) : examResult.answers;
      
      const answers = {
        mc: rawAnswers.mc || {},
        essay: rawAnswers.essay || {}
      };

      let reviewHTML = '';
      
      const mcList = (questions.mc || []).map((q, idx) => ({ ...q, id: q.id || `mc_${idx}` }));
      const essayList = (questions.essay || []).map((q, idx) => ({ ...q, id: q.id || `essay_${idx}` }));

      mcList.forEach((q, i) => {
        const userAnswerKey = answers.mc[q.id] !== undefined ? answers.mc[q.id] : answers.mc[i];
        const correctAnswerKey = q.answer;
        const isCorrect = userAnswerKey === correctAnswerKey;
        reviewHTML += `
          <div class="border-2 ${isCorrect ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'} rounded-lg p-3">
            <div class="flex items-start justify-between mb-2">
              <p class="font-bold text-gray-800 flex-1"><span class="badge ${isCorrect ? 'badge-success' : 'badge-danger'}">ข้อที่ ${i + 1}</span> ${q.question}</p>
              <span class="text-xs font-bold ${isCorrect ? 'text-green-600' : 'text-red-600'}">
                ${isCorrect ? '<i class="fas fa-check-circle"></i> ถูกต้อง' : '<i class="fas fa-times-circle"></i> ผิด'}
              </span>
            </div>
            <div class="space-y-1 text-sm pl-4">
              ${q.choices.map(c => `
                <div class="${c.key === correctAnswerKey ? 'font-bold text-green-700 bg-green-100 -ml-4 pl-4 py-1 rounded' : c.key === userAnswerKey ? 'font-bold text-red-700 bg-red-100 -ml-4 pl-4 py-1 rounded' : 'text-gray-700'}">
                  <span class="font-semibold">${c.key}.</span> ${c.text}
                  ${c.key === correctAnswerKey ? '<i class="fas fa-check-circle ml-2 text-green-600"></i>' : ''}
                  ${c.key === userAnswerKey && c.key !== correctAnswerKey ? '<i class="fas fa-times-circle ml-2 text-red-600"></i>' : ''}
                </div>
              `).join('')}
            </div>
            ${userAnswerKey ? `<p class="text-xs text-gray-600 mt-2">คำตอบของคุณ: <strong>${userAnswerKey}</strong></p>` : '<p class="text-xs text-gray-500 mt-2"><em>ไม่ได้ตอบ</em></p>'}
          </div>
        `;
      });

      essayList.forEach((q, i) => {
        const userAnswer = answers.essay[q.id] !== undefined ? answers.essay[q.id] : answers.essay[i];
        reviewHTML += `
          <div class="border-2 border-orange-300 bg-orange-50 rounded-lg p-3">
            <p class="font-bold text-gray-800 mb-2"><span class="badge badge-warning">ข้อที่ ${mcList.length + i + 1}</span> ${q.question}</p>
            <div class="bg-white rounded border-2 border-orange-200 p-2 text-sm text-gray-700 min-h-12 font-sarabun">
              ${userAnswer ? userAnswer : '<em class="text-gray-400">ไม่ได้ตอบ</em>'}
            </div>
            <p class="text-xs text-orange-600 mt-2"><i class="fas fa-clipboard-list mr-1"></i>รอตรวจจากครู (คะแนนเต็ม: ${q.maxScore})</p>
          </div>
        `;
      });

      if (contentDiv) contentDiv.innerHTML = reviewHTML;
    }

    function toggleAnswerReview() {
      const contentDiv = document.getElementById('answer-review-content');
      const icon = document.getElementById('review-toggle-icon');
      
      contentDiv.classList.toggle('hidden');
      icon.classList.toggle('fa-eye');
      icon.classList.toggle('fa-eye-slash');
    }

    async function ensureXLSXLoaded() {
      if (typeof XLSX !== 'undefined') return true;
      const cdnList = [
        'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
        'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
      ];
      for (const url of cdnList) {
        try {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = url;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
          });
          if (typeof XLSX !== 'undefined') return true;
        } catch (e) {
          console.warn('Cannot load XLSX from:', url);
        }
      }
      return typeof XLSX !== 'undefined';
    }

    function downloadBlob(blob, filename) {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      }, 150);
    }

    function exportExcelXML(headers, rows, filename, sheetTitle = 'Sheet1') {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<?mso-application progid="Excel.Sheet"?>\n' +
        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n' +
        ' xmlns:o="urn:schemas-microsoft-com:office:office"\n' +
        ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n' +
        ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n' +
        ' xmlns:html="http://www.w3.org/TR/REC-html40">\n' +
        '<Styles>\n' +
        ' <Style ss:ID="HeaderStyle">\n' +
        '  <Font ss:Bold="1" ss:Color="#FFFFFF" ss:FontName="Sarabun" ss:Size="11"/>\n' +
        '  <Interior ss:Color="#2563EB" ss:Pattern="Solid"/>\n' +
        '  <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>\n' +
        ' </Style>\n' +
        ' <Style ss:ID="DefaultStyle">\n' +
        '  <Font ss:FontName="Sarabun" ss:Size="10"/>\n' +
        '  <Alignment ss:Vertical="Center"/>\n' +
        ' </Style>\n' +
        '</Styles>\n' +
        `<Worksheet ss:Name="${sheetTitle.replace(/[\\/?*\[\]]/g, '')}">\n` +
        '<Table ss:DefaultRowHeight="20">\n';

      headers.forEach(() => {
        xml += '<Column ss:AutoFitWidth="1" ss:Width="130"/>\n';
      });

      xml += '<Row ss:StyleID="HeaderStyle" ss:Height="26">\n';
      headers.forEach(h => {
        const clean = String(h || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        xml += `<Cell><Data ss:Type="String">${clean}</Data></Cell>\n`;
      });
      xml += '</Row>\n';

      rows.forEach(r => {
        xml += '<Row ss:StyleID="DefaultStyle">\n';
        r.forEach(val => {
          const isNumber = typeof val === 'number' && !isNaN(val);
          const cleanVal = String(val !== undefined && val !== null ? val : '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          xml += `<Cell><Data ss:Type="${isNumber ? 'Number' : 'String'}">${cleanVal}</Data></Cell>\n`;
        });
        xml += '</Row>\n';
      });

      xml += '</Table>\n</Worksheet>\n</Workbook>';

      const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      downloadBlob(blob, filename);
      logActivity(`ส่งออกไฟล์ Excel สำรอง: ${sheetTitle}`);
      showAlert('success', 'ส่งออกสำเร็จ', `ดาวน์โหลดไฟล์ ${filename} เรียบร้อยแล้ว`);
    }

    async function exportData(type, format = 'csv') {
      let data = [];
      let filename = '';
      let headers = [];

      switch(type) {
        case 'members':
          data = getMembers();
          filename = 'สมาชิกระบบ';
          headers = ['ลำดับ', 'ชื่อผู้ใช้', 'ชื่อ-สกุล', 'อีเมล', 'สถานะ', 'บทบาท'];
          break;
        case 'exams':
          data = getExams();
          filename = 'ข้อสอบ';
          headers = ['ลำดับ', 'รายวิชา', 'จำนวนข้อ', 'คะแนนเต็ม', 'เกณฑ์ผ่าน', 'เวลา(นาที)', 'สถานะ'];
          break;
        case 'students':
          data = getStudents();
          filename = 'ข้อมูลผู้สอบ';
          headers = ['ลำดับ', 'รหัสนักเรียน', 'ชื่อ-สกุล', 'ชั้น', 'ห้อง', 'เลขที่', 'รายวิชา'];
          break;
        case 'results':
          data = getResults();
          filename = 'ผลสอบ';
          headers = ['ลำดับ', 'รหัสนักเรียน', 'ชื่อ-สกุล', 'รายวิชา', 'คะแนนปรนัย', 'คะแนนอัตนัย', 'คะแนนรวม', 'เวลาส่ง', 'สถานะ'];
          break;
      }

      if (data.length === 0) {
        showAlert('warning', 'ไม่มีข้อมูล', 'ไม่พบข้อมูลสำหรับส่งออก');
        return;
      }

      let rows = [];
      data.forEach((item, index) => {
        let row = [];
        switch(type) {
          case 'members':
            row = [index + 1, item.username, item.fullname, item.email, item.status === 'active' ? 'อนุมัติแล้ว' : 'รออนุมัติ', item.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ครู'];
            break;
          case 'exams':
            const questions = item.questions ? (typeof item.questions === 'string' ? JSON.parse(item.questions) : item.questions) : { mc: [], essay: [] };
            const totalQuestions = (questions.mc?.length || 0) + (questions.essay?.length || 0);
            row = [index + 1, item.subject_name, totalQuestions, item.total_score, item.passing_score !== undefined ? item.passing_score : (item.total_score / 2), item.time_limit, item.is_visible ? 'เปิด' : 'ปิด'];
            break;
          case 'students':
            row = [index + 1, item.student_id, item.fullname, item.class_name, item.room, item.number, item.subject_name];
            break;
          case 'results':
            const mcScoreExp = item.mc_score !== undefined ? item.mc_score : 0;
            const essayScoreExp = item.essay_score !== undefined ? item.essay_score : (item.graded ? 0 : 'รอตรวจ');
            row = [index + 1, item.student_id, item.fullname, item.subject_name, mcScoreExp, essayScoreExp, `${item.score}/${item.total_score}`, new Date(item.submitted_at).toLocaleString('th-TH'), item.graded ? 'ตรวจแล้ว' : 'รอตรวจ'];
            break;
        }
        rows.push(row);
      });

      const timestamp = new Date().toISOString().split('T')[0];

      if (format === 'excel') {
        try {
          const isLoaded = await ensureXLSXLoaded();

          if (isLoaded && typeof XLSX !== 'undefined') {
            const wsData = [headers, ...rows];
            const worksheet = XLSX.utils.aoa_to_sheet(wsData);
            
            const colWidths = headers.map(() => ({ wch: 22 }));
            worksheet['!cols'] = colWidths;
            
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'ข้อมูล');
            
            const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const filename_excel = `${filename}_${timestamp}.xlsx`;
            downloadBlob(blob, filename_excel);
            logActivity(`ส่งออกไฟล์ Excel: ${filename}`);
            showAlert('success', 'ส่งออกสำเร็จ', `ดาวน์โหลดไฟล์ ${filename_excel} เรียบร้อยแล้ว`);
            return;
          } else {
            exportExcelXML(headers, rows, `${filename}_${timestamp}.xls`, filename);
            return;
          }
        } catch (error) {
          console.warn('XLSX writing error, switching to XML Excel format:', error);
          try {
            exportExcelXML(headers, rows, `${filename}_${timestamp}.xls`, filename);
          } catch (errFallback) {
            showAlert('error', 'ผิดพลาด', 'ไม่สามารถสร้างไฟล์ Excel ได้ โปรดลองใช้ CSV แทน');
          }
        }
      } else {
        let csv = '\uFEFF' + headers.join(',') + '\n';
        rows.forEach(row => {
          csv += row.map(cell => {
            const cellStr = String(cell);
            return cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') 
              ? `"${cellStr.replace(/"/g, '""')}"` 
              : `"${cellStr}"`;
          }).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const filename_csv = `${filename}_${timestamp}.csv`;
        downloadBlob(blob, filename_csv);
        logActivity(`ส่งออกไฟล์ CSV: ${filename}`);
        showAlert('success', 'ส่งออกสำเร็จ', `ดาวน์โหลดไฟล์ ${filename_csv} เรียบร้อยแล้ว`);
      }
    }

    window.onload = initApp;
  