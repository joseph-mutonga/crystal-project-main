/**
 * Crystal Crest - Cashier PIN Pad Login Logic (public/cashier/js/login.js)
 */

let pinDigits = [];

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setupPinPad());
} else {
  setupPinPad();
}

function setupPinPad() {
  const numBtns = document.querySelectorAll('.pin-num-btn');
  const clearBtn = document.getElementById('pin-clear-btn');
  const backspaceBtn = document.getElementById('pin-backspace-btn');
  const submitBtn = document.getElementById('pin-submit-btn');

  numBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (pinDigits.length < 4) {
        const val = e.currentTarget.getAttribute('data-num');
        pinDigits.push(val);
        updateDots();
        if (pinDigits.length === 4) {
          submitPin();
        }
      }
    });
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      pinDigits = [];
      updateDots();
      hideAlert();
    });
  }

  if (backspaceBtn) {
    backspaceBtn.addEventListener('click', () => {
      if (pinDigits.length > 0) {
        pinDigits.pop();
        updateDots();
        hideAlert();
      }
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      submitPin();
    });
  }
}

function updateDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (!dot) continue;

    if (i < pinDigits.length) {
      dot.className = "w-4 h-4 rounded-full bg-[#E8C500] border-2 border-[#E8C500] shadow-[0_0_8px_rgba(232,197,0,0.8)] scale-110 transition-all duration-200";
    } else {
      dot.className = "w-4 h-4 rounded-full border-2 border-gray-500 transition-all duration-200";
    }
  }
}

function showAlert(message) {
  const alertBox = document.getElementById('pin-alert');
  if (!alertBox) return;

  const isDeactivated = message.toLowerCase().includes('no longer active') || message.toLowerCase().includes('deactivated');

  if (isDeactivated) {
    alertBox.className = "p-3.5 rounded-xl text-xs text-center border font-bold bg-amber-500/20 border-amber-400 text-amber-300 shadow-md";
    alertBox.innerHTML = `⚠️ ${message}`;
  } else {
    alertBox.className = "p-3.5 rounded-xl text-xs text-center border font-semibold bg-red-500/20 border-red-500/40 text-red-300";
    alertBox.innerHTML = message;
  }

  alertBox.classList.remove('hidden');
}

function hideAlert() {
  const alertBox = document.getElementById('pin-alert');
  if (alertBox) {
    alertBox.classList.add('hidden');
  }
}

async function submitPin() {
  const pin = pinDigits.join('');
  hideAlert();

  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    showAlert("PIN must be exactly 4 numeric digits.");
    return;
  }

  const submitBtn = document.getElementById('pin-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Verifying PIN...';
  }

  try {
    const res = await fetch('/api/auth/cashier-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pin })
    });

    const data = await res.json();

    if (data.success) {
      window.location.href = 'dashboard.html';
    } else {
      showAlert(data.error || 'Invalid Cashier PIN.');
      pinDigits = [];
      updateDots();
    }
  } catch (err) {
    showAlert('Server connection error. Please try again.');
    pinDigits = [];
    updateDots();
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Log In to Register';
    }
  }
}
