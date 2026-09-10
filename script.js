const screenSplash = document.getElementById('screenSplash');
const screenLogin = document.getElementById('screenLogin');
const screenSignup = document.getElementById('screenSignup');
const screenGST = document.getElementById('screenGST');
const screenHome = document.getElementById('screenHome');
const dust = document.getElementById('dust');
const reticleLite = document.getElementById('reticleLite');

function spawnDust() {
  dust.innerHTML = '';
  const positions = [
    [30, 68], [70, 62], [22, 40], [78, 45], [50, 78], [40, 30], [60, 82]
  ];
  positions.forEach(([x, y], i) => {
    const m = document.createElement('span');
    m.className = 'mote';
    m.style.left = x + '%';
    m.style.top = y + '%';
    m.style.setProperty('--md', (0.7 + i * 0.32) + 's');
    dust.appendChild(m);
  });
}

let timers = [];
function clearTimers() { timers.forEach(clearTimeout); timers = []; }
function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

function playSplash() {
  clearTimers();

  screenSplash.classList.remove('exit');
  screenSplash.classList.add('active');
  screenLogin.classList.remove('active', 'enter', 'enter-left');
  screenSignup.classList.remove('active', 'enter-right');

  reticleLite.classList.remove('settle');
  void reticleLite.offsetWidth; // restart CSS animations

  spawnDust();

  at(1500, () => reticleLite.classList.add('settle'));

  at(2300, () => screenSplash.classList.add('exit'));
  at(2700, () => {
    screenSplash.classList.remove('active');
    screenLogin.classList.add('active', 'enter');
  });
}

document.getElementById('replayBtn').addEventListener('click', playSplash);

document.getElementById('goSignup').addEventListener('click', (e) => {
  e.preventDefault();
  screenSignup.classList.remove('exit-right');
  screenSignup.classList.add('active', 'enter-right');
  screenLogin.classList.remove('active');
});

document.getElementById('backToLogin').addEventListener('click', () => {
  screenSignup.classList.add('exit-right');
  setTimeout(() => {
    screenSignup.classList.remove('active', 'enter-right', 'exit-right');
    screenLogin.classList.add('active', 'enter-left');
  }, 320);
});

document.getElementById('goLogin').addEventListener('click', (e) => {
  e.preventDefault();
  screenSignup.classList.add('exit-right');
  setTimeout(() => {
    screenSignup.classList.remove('active', 'enter-right', 'exit-right');
    screenLogin.classList.add('active', 'enter-left');
  }, 320);
});

// ---- test login credentials -> home ----
const TEST_USER_ID = 'demo';
const TEST_PASSWORD = 'demo123';
const loginUserId = document.getElementById('loginUserId');
const loginErrorMsg = document.getElementById('loginErrorMsg');
const loginUserIdField = loginUserId.closest('.field');
const loginPasswordField = document.getElementById('loginPassword').closest('.field');

[loginUserId, document.getElementById('loginPassword')].forEach((input) => {
  input.addEventListener('input', () => {
    loginUserIdField.classList.remove('invalid');
    loginPasswordField.classList.remove('invalid');
    loginErrorMsg.classList.remove('show');
  });
});

document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const loginPasswordInput = document.getElementById('loginPassword');
  const ok = loginUserId.value.trim() === TEST_USER_ID && loginPasswordInput.value === TEST_PASSWORD;
  if (!ok) {
    loginUserIdField.classList.add('invalid');
    loginPasswordField.classList.add('invalid');
    loginErrorMsg.classList.add('show');
    const wrap = loginPasswordField.querySelector('.input-wrap');
    wrap.classList.remove('shake');
    void wrap.offsetWidth;
    wrap.classList.add('shake');
    return;
  }
  loginUserIdField.classList.remove('invalid');
  loginPasswordField.classList.remove('invalid');
  loginErrorMsg.classList.remove('show');
  screenLogin.classList.remove('active');
  screenHome.classList.remove('exit-right');
  screenHome.classList.add('active', 'enter-right');
  updateNavForScreen(screenHome);
});

function wireEyeToggle(buttonId, inputId) {
  const btn = document.getElementById(buttonId);
  const input = document.getElementById(inputId);
  btn.addEventListener('click', () => {
    const showing = btn.classList.toggle('showing');
    input.type = showing ? 'text' : 'password';
    btn.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
  });
}
wireEyeToggle('togglePassword', 'loginPassword');
wireEyeToggle('toggleSignupPassword', 'signupPassword');

// ---- signup form refs + per-field validation ----
const signupName = document.getElementById('signupName');
const signupCompany = document.getElementById('signupCompany');
const phoneInput = document.getElementById('signupPhone');
const signupUserId = document.getElementById('signupUserId');
const signupPassword = document.getElementById('signupPassword');
const signupSubmitBtn = document.getElementById('signupSubmitBtn');

function setInvalid(fieldEl, invalid) {
  fieldEl.classList.toggle('invalid', invalid);
}

function shakeField(fieldEl) {
  const target = fieldEl.querySelector('.input-wrap') || fieldEl;
  target.classList.remove('shake');
  void target.offsetWidth;
  target.classList.add('shake');
}

const fieldChecks = {
  name: () => signupName.value.trim().length > 0,
  company: () => signupCompany.value.trim().length > 0,
  phone: () => phoneInput.value.trim().length > 0,
  userId: () => signupUserId.value.trim().length > 0,
  password: () => signupPassword.value.trim().length >= 6,
};

function wireLiveValidation(input, kind) {
  const fieldEl = input.closest('.field');
  input.addEventListener('blur', () => setInvalid(fieldEl, !fieldChecks[kind]()));
  input.addEventListener('input', () => setInvalid(fieldEl, false));
}
wireLiveValidation(signupName, 'name');
wireLiveValidation(signupCompany, 'company');
wireLiveValidation(phoneInput, 'phone');
wireLiveValidation(signupUserId, 'userId');
wireLiveValidation(signupPassword, 'password');

function validateSignupFields() {
  let firstInvalid = null;
  Object.entries(fieldChecks).forEach(([kind, check]) => {
    const input = { name: signupName, company: signupCompany, phone: phoneInput, userId: signupUserId, password: signupPassword }[kind];
    const fieldEl = input.closest('.field');
    const ok = check();
    setInvalid(fieldEl, !ok);
    if (!ok && !firstInvalid) firstInvalid = fieldEl;
  });
  if (firstInvalid) {
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    shakeField(firstInvalid);
    return false;
  }
  return true;
}

// ---- reusable OTP controller: 6-digit auto-advance + auto-verify + resend timer ----
// Used for the signup phone OTP, and reused as-is for Forgot User ID / Forgot Password below.
function createOtpController({ collapseId, digitsContainerId, timerTextId, timerValId, resendLinkId, onComplete }) {
  const collapse = document.getElementById(collapseId);
  const digits = [...document.querySelectorAll(`#${digitsContainerId} .otp-digit`)];
  const timerText = document.getElementById(timerTextId);
  const timerVal = document.getElementById(timerValId);
  const resendLink = document.getElementById(resendLinkId);
  let interval = null;

  function clear() {
    digits.forEach((d) => { d.value = ''; d.classList.remove('filled'); });
  }

  function startTimer(seconds) {
    clearInterval(interval);
    resendLink.classList.remove('active');
    timerText.style.display = '';
    let remaining = seconds;
    const render = () => {
      const m = Math.floor(remaining / 60);
      const s = String(remaining % 60).padStart(2, '0');
      timerVal.textContent = `${m}:${s}`;
    };
    render();
    interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        timerText.style.display = 'none';
        resendLink.classList.add('active');
        return;
      }
      render();
    }, 1000);
  }

  function maybeAutoVerify() {
    const code = digits.map((d) => d.value).join('');
    if (code.length < 6) return;
    clearInterval(interval);
    digits.forEach((d) => d.setAttribute('disabled', 'true'));
    setTimeout(onComplete, 450);
  }

  digits.forEach((digit, i) => {
    digit.addEventListener('input', () => {
      digit.value = digit.value.replace(/[^0-9]/g, '').slice(0, 1);
      digit.classList.toggle('filled', digit.value !== '');
      if (digit.value && digits[i + 1]) digits[i + 1].focus();
      maybeAutoVerify();
    });
    digit.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !digit.value && digits[i - 1]) digits[i - 1].focus();
    });
    digit.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
      if (!text) return;
      e.preventDefault();
      text.slice(0, 6).split('').forEach((ch, j) => {
        if (digits[j]) { digits[j].value = ch; digits[j].classList.add('filled'); }
      });
      const next = digits[Math.min(text.length, 5)];
      if (next) next.focus();
      maybeAutoVerify();
    });
  });

  resendLink.addEventListener('click', (e) => {
    e.preventDefault();
    clear();
    digits[0].focus();
    startTimer(30);
  });

  function send() {
    collapse.classList.add('open');
    clear();
    digits.forEach((d) => d.removeAttribute('disabled'));
    startTimer(30);
  }

  function reset() {
    clearInterval(interval);
    collapse.classList.remove('open');
    clear();
    digits.forEach((d) => d.removeAttribute('disabled'));
  }

  return { digits, send, reset };
}

const otpCollapse = document.getElementById('otpCollapse');
const otpBox = document.getElementById('otpBox');
const signupOtp = createOtpController({
  collapseId: 'otpCollapse',
  digitsContainerId: 'otpDigits',
  timerTextId: 'otpTimerText',
  timerValId: 'otpTimerVal',
  resendLinkId: 'resendOtpLink',
  onComplete: () => {
    screenSignup.classList.remove('active');
    screenGST.classList.remove('exit-right');
    screenGST.classList.add('active', 'enter-right');
  },
});

// ---- Submit: validate -> auto-send OTP -> OTP auto-verifies -> GST screen ----
document.getElementById('signupForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validateSignupFields()) return;

  signupSubmitBtn.disabled = true;
  signupSubmitBtn.textContent = 'Sending OTP…';
  signupOtp.send();
  setTimeout(() => {
    signupOtp.digits[0].focus();
    otpBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 380);
});

function resetSignupForm() {
  signupOtp.reset();
  signupSubmitBtn.disabled = false;
  signupSubmitBtn.textContent = 'Submit';
}

document.getElementById('backToSignup').addEventListener('click', () => {
  resetSignupForm();
  screenGST.classList.add('exit-right');
  setTimeout(() => {
    screenGST.classList.remove('active', 'enter-right', 'exit-right');
    screenSignup.classList.add('active', 'enter-left');
  }, 320);
});

const gstInput = document.getElementById('gstInput');
const verifyGstBtn = document.getElementById('verifyGstBtn');
const gstCollapse = document.getElementById('gstCollapse');
const gstResultCard = document.getElementById('gstResultCard');
const gstBizName = document.getElementById('gstBizName');
const gstAddress = document.getElementById('gstAddress');
const successToast = document.getElementById('successToast');

verifyGstBtn.addEventListener('click', () => {
  if (!gstInput.value.trim()) { gstInput.focus(); return; }
  gstInput.readOnly = true;
  verifyGstBtn.disabled = true;
  verifyGstBtn.textContent = 'Verifying…';

  setTimeout(() => {
    // mock API response
    gstBizName.textContent = 'Gupta Jewellers Pvt. Ltd.';
    gstAddress.textContent = 'MG Road, Jaipur, Rajasthan';
    verifyGstBtn.textContent = 'Verified';
    gstCollapse.classList.add('open');

    setTimeout(() => gstResultCard.scrollIntoView({ behavior: 'smooth', block: 'center' }), 420);
    setTimeout(() => {
      successToast.classList.add('show');
      successToast.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 700);
    setTimeout(() => {
      screenGST.classList.remove('active');
      screenHome.classList.remove('exit-right');
      screenHome.classList.add('active', 'enter-right');
      updateNavForScreen(screenHome);
    }, 2700);
  }, 900);
});

// ---- Forgot User ID ----
const screenForgotId = document.getElementById('screenForgotId');
const forgotIdPhone = document.getElementById('forgotIdPhone');
const forgotIdPhoneField = forgotIdPhone.closest('.field');
const sendCodeForgotId = document.getElementById('sendCodeForgotId');
const forgotIdResultCollapse = document.getElementById('forgotIdResultCollapse');

const forgotIdOtp = createOtpController({
  collapseId: 'otpCollapseForgotId',
  digitsContainerId: 'otpDigitsForgotId',
  timerTextId: 'otpTimerTextForgotId',
  timerValId: 'otpTimerValForgotId',
  resendLinkId: 'resendOtpForgotId',
  onComplete: () => {
    forgotIdResultCollapse.classList.add('open');
    setTimeout(() => forgotIdResultCollapse.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
  },
});

sendCodeForgotId.addEventListener('click', () => {
  if (!forgotIdPhone.value.trim()) {
    setInvalid(forgotIdPhoneField, true);
    shakeField(forgotIdPhoneField);
    forgotIdPhone.focus();
    return;
  }
  setInvalid(forgotIdPhoneField, false);
  forgotIdPhone.readOnly = true;
  sendCodeForgotId.disabled = true;
  sendCodeForgotId.textContent = 'Sent';
  forgotIdOtp.send();
  setTimeout(() => {
    forgotIdOtp.digits[0].focus();
    document.getElementById('otpBoxForgotId').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 380);
});
forgotIdPhone.addEventListener('input', () => setInvalid(forgotIdPhoneField, false));

function resetForgotIdScreen() {
  forgotIdOtp.reset();
  forgotIdResultCollapse.classList.remove('open');
  forgotIdPhone.value = '';
  forgotIdPhone.readOnly = false;
  sendCodeForgotId.disabled = false;
  sendCodeForgotId.textContent = 'Send code';
  setInvalid(forgotIdPhoneField, false);
}

document.getElementById('goForgotId').addEventListener('click', (e) => {
  e.preventDefault();
  resetForgotIdScreen();
  screenLogin.classList.remove('active');
  screenForgotId.classList.remove('exit-right');
  screenForgotId.classList.add('active', 'enter-right');
});

function backToLoginFrom(screenEl) {
  screenEl.classList.add('exit-right');
  setTimeout(() => {
    screenEl.classList.remove('active', 'enter-right', 'exit-right');
    screenLogin.classList.add('active', 'enter-left');
  }, 320);
}

function backToScreenFrom(screenEl, targetScreen) {
  screenEl.classList.add('exit-right');
  setTimeout(() => {
    screenEl.classList.remove('active', 'enter-right', 'exit-right');
    targetScreen.classList.add('active', 'enter-left');
  }, 320);
}

document.getElementById('backFromForgotId').addEventListener('click', () => backToLoginFrom(screenForgotId));
document.getElementById('forgotIdDoneBtn').addEventListener('click', () => backToLoginFrom(screenForgotId));

// ---- Forgot Password ----
const screenForgotPassword = document.getElementById('screenForgotPassword');
const forgotPwUserId = document.getElementById('forgotPwUserId');
const forgotPwUserIdField = forgotPwUserId.closest('.field');
const sendCodeForgotPw = document.getElementById('sendCodeForgotPw');
const newPasswordCollapse = document.getElementById('newPasswordCollapse');
const newPassword1 = document.getElementById('newPassword1');
const newPassword2 = document.getElementById('newPassword2');
const resetSuccessToast = document.getElementById('resetSuccessToast');

wireEyeToggle('toggleNewPassword1', 'newPassword1');
wireEyeToggle('toggleNewPassword2', 'newPassword2');

const forgotPwOtp = createOtpController({
  collapseId: 'otpCollapseForgotPw',
  digitsContainerId: 'otpDigitsForgotPw',
  timerTextId: 'otpTimerTextForgotPw',
  timerValId: 'otpTimerValForgotPw',
  resendLinkId: 'resendOtpForgotPw',
  onComplete: () => {
    newPasswordCollapse.classList.add('open');
    setTimeout(() => {
      newPassword1.focus();
      newPasswordCollapse.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  },
});

sendCodeForgotPw.addEventListener('click', () => {
  if (!forgotPwUserId.value.trim()) {
    setInvalid(forgotPwUserIdField, true);
    shakeField(forgotPwUserIdField);
    forgotPwUserId.focus();
    return;
  }
  setInvalid(forgotPwUserIdField, false);
  forgotPwUserId.readOnly = true;
  sendCodeForgotPw.disabled = true;
  sendCodeForgotPw.textContent = 'Sent';
  forgotPwOtp.send();
  setTimeout(() => {
    forgotPwOtp.digits[0].focus();
    document.getElementById('otpBoxForgotPw').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 380);
});
forgotPwUserId.addEventListener('input', () => setInvalid(forgotPwUserIdField, false));

[newPassword1, newPassword2].forEach((input) => {
  input.addEventListener('input', () => setInvalid(input.closest('.field'), false));
});

document.getElementById('resetPasswordBtn').addEventListener('click', () => {
  const pw1Field = newPassword1.closest('.field');
  const pw2Field = newPassword2.closest('.field');
  const pw1Valid = newPassword1.value.trim().length >= 6;
  const pw2Valid = pw1Valid && newPassword2.value === newPassword1.value;

  setInvalid(pw1Field, !pw1Valid);
  setInvalid(pw2Field, !pw2Valid);

  if (!pw1Valid) { pw1Field.scrollIntoView({ behavior: 'smooth', block: 'center' }); shakeField(pw1Field); return; }
  if (!pw2Valid) { pw2Field.scrollIntoView({ behavior: 'smooth', block: 'center' }); shakeField(pw2Field); return; }

  resetSuccessToast.classList.add('show');
  setTimeout(() => backToScreenFrom(screenForgotPassword, forgotPwReturnScreen), 1600);
});

function resetForgotPasswordScreen() {
  forgotPwOtp.reset();
  newPasswordCollapse.classList.remove('open');
  resetSuccessToast.classList.remove('show');
  forgotPwUserId.value = '';
  forgotPwUserId.readOnly = false;
  sendCodeForgotPw.disabled = false;
  sendCodeForgotPw.textContent = 'Send code';
  newPassword1.value = '';
  newPassword2.value = '';
  setInvalid(forgotPwUserIdField, false);
  setInvalid(newPassword1.closest('.field'), false);
  setInvalid(newPassword2.closest('.field'), false);
}

let forgotPwReturnScreen = screenLogin;

document.getElementById('goForgotPw').addEventListener('click', (e) => {
  e.preventDefault();
  forgotPwReturnScreen = screenLogin;
  resetForgotPasswordScreen();
  screenLogin.classList.remove('active');
  screenForgotPassword.classList.remove('exit-right');
  screenForgotPassword.classList.add('active', 'enter-right');
});

document.getElementById('backFromForgotPw').addEventListener('click', () => backToScreenFrom(screenForgotPassword, forgotPwReturnScreen));

// ---- Dashboard <-> Scanner flow (Home -> Capture -> Processing -> Review -> Final) ----
const screenSettings = document.getElementById('screenSettings');
const screenDashSettings = document.getElementById('screenDashSettings');
const screenMasterRates = document.getElementById('screenMasterRates');
const screenItemCode = document.getElementById('screenItemCode');
const screenBizProfile = document.getElementById('screenBizProfile');
const screenWishlist = document.getElementById('screenWishlist');
const screenNotifications = document.getElementById('screenNotifications');
const screenSubscription = document.getElementById('screenSubscription');
const screenPasswordManager = document.getElementById('screenPasswordManager');
const screenEarnInvite = document.getElementById('screenEarnInvite');
const screenContactUs = document.getElementById('screenContactUs');
const screenFaqs = document.getElementById('screenFaqs');
const screenEmpList = document.getElementById('screenEmpList');
const screenEmpAdd = document.getElementById('screenEmpAdd');
const screenEmpCredentials = document.getElementById('screenEmpCredentials');
const screenEmpPermissions = document.getElementById('screenEmpPermissions');
const screenEmpPassword = document.getElementById('screenEmpPassword');
const screenEmpDetail = document.getElementById('screenEmpDetail');
const screenScanCapture = document.getElementById('screenScanCapture');
const screenScanProcessing = document.getElementById('screenScanProcessing');
const screenScanReview = document.getElementById('screenScanReview');
const screenInvoiceGen = document.getElementById('screenInvoiceGen');
const screenInvoicePreview = document.getElementById('screenInvoicePreview');

function goForward(fromScreen, toScreen) {
  fromScreen.classList.remove('active');
  toScreen.classList.remove('exit-right');
  toScreen.classList.add('active', 'enter-right');
}
function goBackward(fromScreen, toScreen) {
  fromScreen.classList.add('exit-right');
  setTimeout(() => {
    fromScreen.classList.remove('active', 'enter-right', 'exit-right');
    toScreen.classList.add('active', 'enter-left');
  }, 320);
}

// -- Capture screen state --
const capInstruction = document.getElementById('capInstruction');
const capControlsStep1 = document.getElementById('capControlsStep1');
const capControlsStep2 = document.getElementById('capControlsStep2');
const capSideIconBtn = document.getElementById('capSideIconBtn');
const capSideIconGallery = document.getElementById('capSideIconGallery');
const capSideIconBin = document.getElementById('capSideIconBin');
let hasFirstCapture = false;

function setCaptureStep(step) {
  hasFirstCapture = step === 'second';
  capControlsStep1.hidden = hasFirstCapture;
  capControlsStep2.hidden = !hasFirstCapture;
  capSideIconGallery.style.display = hasFirstCapture ? 'none' : '';
  capSideIconBin.style.display = hasFirstCapture ? '' : 'none';
  capSideIconBtn.setAttribute('aria-label', hasFirstCapture ? 'Delete captured image' : 'Upload from gallery');
  capInstruction.textContent = hasFirstCapture ? 'Align back side of tag inside frame' : 'Align jewellery tag inside frame';
}
function resetCaptureScreen() {
  setCaptureStep('first');
}

document.getElementById('capBackBtn').addEventListener('click', () => goBackward(screenScanCapture, screenHome));

document.getElementById('capShutterBtn').addEventListener('click', () => {
  setCaptureStep('second');
});
capSideIconBtn.addEventListener('click', () => {
  setCaptureStep(hasFirstCapture ? 'first' : 'second');
});
document.getElementById('capSecondSideBtn').addEventListener('click', () => {
  capInstruction.textContent = 'Back side captured — tap Calculate to continue';
});
document.getElementById('capCalcBtn').addEventListener('click', () => {
  startProcessing();
});

// -- Processing screen: animated progress through real stages --
const procPercent = document.getElementById('procPercent');
const procStage = document.getElementById('procStage');
const PROC_STAGES = [
  { upTo: 28, label: 'Uploading Tags...' },
  { upTo: 82, label: 'Processing Tag Details...' },
  { upTo: 100, label: 'Loading Scanned Results...' },
];
let procInterval = null;

function startProcessing() {
  goForward(screenScanCapture, screenScanProcessing);
  let value = 0;
  procPercent.textContent = '0%';
  procStage.textContent = PROC_STAGES[0].label;
  clearInterval(procInterval);
  procInterval = setInterval(() => {
    value += Math.random() < 0.3 ? 2 : 1;
    if (value > 100) value = 100;
    procPercent.textContent = value + '%';
    const stage = PROC_STAGES.find((s) => value <= s.upTo) || PROC_STAGES[PROC_STAGES.length - 1];
    procStage.textContent = stage.label;
    if (value >= 100) {
      clearInterval(procInterval);
      setTimeout(() => goForward(screenScanProcessing, screenScanReview), 400);
    }
  }, 45);
}

// -- Review screen --
document.getElementById('revBackBtn').addEventListener('click', () => goBackward(screenScanReview, screenHome));
document.getElementById('revRescanBtn').addEventListener('click', () => {
  resetCaptureScreen();
  goBackward(screenScanReview, screenScanCapture);
});
document.getElementById('revContinueBtn').addEventListener('click', () => goForward(screenScanReview, screenInvoiceGen));

function wireWishlistToggle(id) {
  document.getElementById(id).addEventListener('click', function () {
    this.textContent = '✓ Added to Wishlist';
    this.disabled = true;
  });
}
wireWishlistToggle('revWishlistBtn');

// -- "+ Add Other Charges" tile: reveal an amount row on click --
const chargesTile = document.getElementById('chargesTile');
const addChargeBtn = document.getElementById('addChargeBtn');
addChargeBtn.addEventListener('click', () => {
  if (chargesTile.querySelector('.charge-row')) return;
  const row = document.createElement('div');
  row.className = 'charge-row';
  row.innerHTML = '<div class="input-icon"><span>₹</span><input placeholder="Amount" value=""></div>';
  chargesTile.appendChild(row);
  addChargeBtn.textContent = '+ Add Another';
  row.querySelector('input').focus();
});

// -- Invoice Generation (customer details) -> Invoice Preview --
document.getElementById('invGenBackBtn').addEventListener('click', () => {
  goBackward(screenInvoiceGen, screenScanReview);
});
function openInvoicePreview(isEInvoice) {
  const name = document.getElementById('invCustName').value.trim() || 'Garg Jewellers';
  const address = document.getElementById('invCustAddress').value.trim() || '11- Upper Bazar, Police Station, Modinagar, Ghaziabad, Uttar Pradesh 201204';
  const gst = document.getElementById('invCustGst').value.trim();
  const pan = document.getElementById('invCustPan').value.trim();

  document.getElementById('invBilledName').textContent = name;
  document.getElementById('invBilledAddress').textContent = address;
  const idLine = document.getElementById('invBilledGst');
  if (gst) {
    idLine.textContent = 'GSTIN: ' + gst;
    idLine.style.display = '';
  } else if (pan) {
    idLine.textContent = 'PAN: ' + pan;
    idLine.style.display = '';
  } else {
    idLine.style.display = 'none';
  }

  document.getElementById('invIrnDivider').classList.toggle('show', isEInvoice);
  document.getElementById('invIrnBlock').classList.toggle('show', isEInvoice);
  document.querySelector('#screenInvoicePreview .set-header-title').textContent = isEInvoice ? 'E-Invoice' : 'Invoice Preview';

  setInvZoom(1);
  goForward(screenInvoiceGen, screenInvoicePreview);
}

document.getElementById('invGenContinueBtn').addEventListener('click', () => openInvoicePreview(false));
document.getElementById('invGenEInvoiceBtn').addEventListener('click', () => openInvoicePreview(true));

// -- Invoice Preview: back, share, download --
document.getElementById('invPreviewBackBtn').addEventListener('click', () => {
  goBackward(screenInvoicePreview, screenInvoiceGen);
});
document.getElementById('invShareBtn').addEventListener('click', () => {
  const name = document.getElementById('invBilledName').textContent;
  const total = document.getElementById('invGrandTotal').textContent;
  const text = encodeURIComponent(`Invoice for ${name}\nGrand Total: ${total}\n— Pratham International (MRPscan)`);
  window.open('https://wa.me/?text=' + text, '_blank');
});
document.getElementById('invDownloadBtn').addEventListener('click', () => {
  setInvZoom(1);
  window.print();
});

// -- Invoice Preview: pinch / wheel / double-tap / button zoom (uses CSS `zoom` so the
//    page-wrap's native scroll can pan around the zoomed sheet, no extra pan logic needed) --
const invSheetEl = document.getElementById('invSheet');
const invPageWrapEl = document.getElementById('invPageWrap');
let invZoomLevel = 1;

function setInvZoom(z) {
  invZoomLevel = Math.min(3, Math.max(1, z));
  invSheetEl.style.zoom = invZoomLevel;
}

document.getElementById('invZoomIn').addEventListener('click', () => setInvZoom(invZoomLevel + 0.25));
document.getElementById('invZoomOut').addEventListener('click', () => setInvZoom(invZoomLevel - 0.25));

invPageWrapEl.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return; // trackpad pinch sends wheel events with ctrlKey
  e.preventDefault();
  setInvZoom(invZoomLevel - e.deltaY * 0.01);
}, { passive: false });

invPageWrapEl.addEventListener('dblclick', () => {
  setInvZoom(invZoomLevel > 1 ? 1 : 2);
});

function touchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}
let pinchStartDist = null;
let pinchStartZoom = 1;
invPageWrapEl.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    pinchStartDist = touchDistance(e.touches);
    pinchStartZoom = invZoomLevel;
  }
});
invPageWrapEl.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && pinchStartDist) {
    e.preventDefault();
    setInvZoom(pinchStartZoom * (touchDistance(e.touches) / pinchStartDist));
  }
}, { passive: false });
invPageWrapEl.addEventListener('touchend', () => { pinchStartDist = null; });

// -- Live date / day / time on the home trial tile --
const dashDayEl = document.getElementById('dashDay');
const dashDateEl = document.getElementById('dashDate');
const dashMonthEl = document.getElementById('dashMonth');
const dashTimeEl = document.getElementById('dashTime');
function renderDashClock() {
  const now = new Date();
  if (dashDayEl) dashDayEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  if (dashDateEl) dashDateEl.textContent = String(now.getDate());
  if (dashMonthEl) dashMonthEl.textContent = now.toLocaleDateString('en-US', { month: 'short' });
  if (dashTimeEl) dashTimeEl.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
renderDashClock();
setInterval(renderDashClock, 30000);

// -- Floating bottom nav: global element, shown on Home / Review / Final only --
const floatingNav = document.getElementById('floatingNav');
const navHomeBtn = document.getElementById('navHomeBtn');
const navScanBtn = document.getElementById('navScanBtn');
const NAV_VISIBLE_SCREENS = [screenHome, screenScanReview, screenInvoiceGen, screenInvoicePreview, screenSettings, screenDashSettings, screenMasterRates, screenItemCode, screenBizProfile, screenWishlist, screenNotifications, screenSubscription, screenPasswordManager, screenEarnInvite, screenContactUs, screenFaqs, screenEmpList, screenEmpAdd, screenEmpCredentials, screenEmpPermissions, screenEmpPassword, screenEmpDetail];
let currentScreen = screenSplash;

function updateNavForScreen(screen) {
  currentScreen = screen;
  const visible = NAV_VISIBLE_SCREENS.includes(screen);
  floatingNav.classList.toggle('show', visible);
  navHomeBtn.classList.toggle('active', screen === screenHome);
  navScanBtn.classList.toggle('active', screen === screenScanCapture);
}

const _goForward = goForward;
goForward = function (fromScreen, toScreen) {
  _goForward(fromScreen, toScreen);
  updateNavForScreen(toScreen);
};
const _goBackward = goBackward;
goBackward = function (fromScreen, toScreen) {
  _goBackward(fromScreen, toScreen);
  setTimeout(() => updateNavForScreen(toScreen), 330);
};

navHomeBtn.addEventListener('click', () => {
  if (currentScreen === screenHome) return;
  goBackward(currentScreen, screenHome);
});
navScanBtn.addEventListener('click', () => {
  if (currentScreen === screenScanCapture) return;
  resetCaptureScreen();
  goForward(currentScreen, screenScanCapture);
});

// -- Settings / menu screen (hamburger on Home) --
document.getElementById('dashMenuBtn').addEventListener('click', () => {
  goForward(screenHome, screenSettings);
});
document.getElementById('setBackBtn').addEventListener('click', () => {
  goBackward(screenSettings, screenHome);
});
document.getElementById('setLogoutBtn').addEventListener('click', () => {
  goBackward(screenSettings, screenLogin);
});
document.getElementById('setMenuDashboard').addEventListener('click', () => {
  goForward(screenSettings, screenDashSettings);
});
document.getElementById('setMenuSubscription').addEventListener('click', () => {
  goForward(screenSettings, screenSubscription);
});
document.getElementById('setMenuPassword').addEventListener('click', () => {
  goForward(screenSettings, screenPasswordManager);
});

// -- Earn & Invite --
document.getElementById('setMenuEarnInvite').addEventListener('click', () => {
  goForward(screenSettings, screenEarnInvite);
});
document.getElementById('earnInviteBackBtn').addEventListener('click', () => {
  goBackward(screenEarnInvite, screenSettings);
});

// -- Share Sheet (global overlay, reused by Earn & Invite and Employee Credentials) --
const shareSheetBackdrop = document.getElementById('shareSheetBackdrop');
const shareOptCopyLabel = document.getElementById('shareOptCopyLabel');
let shareSheetMessage = '';

function openShareSheet(message) {
  shareSheetMessage = message;
  shareSheetBackdrop.classList.add('show');
}
function closeShareSheet() {
  shareSheetBackdrop.classList.remove('show');
}
document.getElementById('earnInviteSendBtn').addEventListener('click', function () {
  openShareSheet('Install MRPscan using my referral link and we both earn credits! https://play.google.com/store/apps/details?id=com.mrpscan.app&referrer=utm_source%3Dinvite_demo123');
});
document.getElementById('earnPurchaseSendBtn').addEventListener('click', function () {
  openShareSheet('Install MRPscan using my referral link and we both earn credits! https://play.google.com/store/apps/details?id=com.mrpscan.app&referrer=utm_source%3Dpurchase_demo123');
});
shareSheetBackdrop.addEventListener('click', (e) => {
  if (e.target === shareSheetBackdrop) closeShareSheet();
});
document.getElementById('shareSheetCancel').addEventListener('click', closeShareSheet);
document.querySelectorAll('.share-opt').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const app = btn.dataset.app;
    if (app === 'whatsapp') {
      window.open('https://wa.me/?text=' + encodeURIComponent(shareSheetMessage), '_blank');
      closeShareSheet();
    } else if (app === 'sms') {
      window.location.href = 'sms:?body=' + encodeURIComponent(shareSheetMessage);
      closeShareSheet();
    } else if (app === 'instagram' || app === 'copy') {
      try {
        await navigator.clipboard.writeText(shareSheetMessage);
      } catch (e) {
        console.error('Clipboard write failed', e);
      }
      if (app === 'copy') {
        const original = shareOptCopyLabel.textContent;
        shareOptCopyLabel.textContent = 'Copied!';
        setTimeout(() => { shareOptCopyLabel.textContent = original; }, 1200);
      }
      setTimeout(closeShareSheet, 500);
    }
  });
});

// -- Contact Us --
document.getElementById('setMenuContactUs').addEventListener('click', () => {
  goForward(screenSettings, screenContactUs);
});
document.getElementById('contactUsBackBtn').addEventListener('click', () => {
  goBackward(screenContactUs, screenSettings);
});
document.getElementById('contactWhatsappBtn').addEventListener('click', () => {
  window.open('https://wa.me/919876543210?text=' + encodeURIComponent('Hi, I need help with MRPscan.'), '_blank');
});

// -- FAQs -- (transcribed from voice notes, grouped by section; en/hi text pairs)
const FAQ_SECTIONS = [
  {
    section: { en: 'Gold', hi: 'सोना' },
    items: [
      { q: { en: 'Can I choose my preferred Bullion source?', hi: 'क्या मैं अपना पसंदीदा Bullion source चुन सकता हूं?' }, a: { en: 'Yes. Dashboard Settings → Choose Bullion Source → select the one you want to show your rates.', hi: 'हां। Dashboard Settings → Choose Bullion Source → जो source अपनी rates के लिए चाहिए, उसे select करें।' } },
      { q: { en: 'Can I add my preferred Bullion source?', hi: 'क्या मैं अपना पसंदीदा Bullion source जोड़ सकता हूं?' }, a: { en: 'Yes. Dashboard Settings → Choose Bullion Source → add your preferred source. We’ll get the required information and update you once it’s done.', hi: 'हां। Dashboard Settings → Choose Bullion Source → अपना पसंदीदा source add करें। जरूरी जानकारी लेकर हमारी टीम आपको अपडेट कर देगी।' } },
      { q: { en: 'How can I choose which rates are shown on my dashboard?', hi: 'मैं अपने dashboard पर कौन-सी rates दिखानी हैं, यह कैसे चुनूं?' }, a: { en: 'Dashboard Settings → select the Cash and RTGS rates you want for 24K, 22K, 20K, 18K, 14K and 9K gold. They’ll show up on your dashboard.', hi: 'Dashboard Settings → 24K, 22K, 20K, 18K, 14K और 9K सोने की जो Cash और RTGS rates चाहिए, उन्हें select करें। वो आपके dashboard पर दिखने लगेंगी।' } },
      { q: { en: 'Can I change the MCX, Cash and RTGS rates that are shown by default?', hi: 'क्या मैं default दिखने वाली MCX, Cash और RTGS rates बदल सकता हूं?' }, a: { en: 'Yes. Dashboard Settings → Masters → Gold → Rates → add or subtract the amount you want. The updated rate will be shown on your dashboard from then on.', hi: 'हां। Dashboard Settings → Masters → Gold → Rates → जितना amount चाहिए उतना add या minus करें। यह नई rate तभी से आपके dashboard पर दिखेगी।' } },
      { q: { en: 'Can I change the purity percentage of gold?', hi: 'क्या मैं सोने की purity percentage बदल सकता हूं?' }, a: { en: 'Yes, for 22K, 18K, 14K and 9K gold. Dashboard Settings → Masters → Gold → edit the purity percentage for each karat. This percentage will be used every time you calculate MRP.', hi: 'हां, 22K, 18K, 14K और 9K सोने के लिए। Dashboard Settings → Masters → Gold → हर karat की purity percentage edit करें। यह percentage हर बार MRP calculate करते समय इस्तेमाल होगी।' } },
      { q: { en: 'How can I choose RTGS or Cash rate while calculating MRP?', hi: 'MRP calculate करते समय RTGS या Cash rate कैसे चुनूं?' }, a: { en: 'After scanning the tag, go to the Gold section → tap RTGS or Cash rate. The MRP will be calculated using that rate automatically.', hi: 'Tag scan करने के बाद, Gold section में जाकर RTGS या Cash rate पर tap करें। MRP उसी rate से automatically calculate हो जाएगी।' } },
    ],
  },
  {
    section: { en: 'Diamond', hi: 'हीरा' },
    items: [
      { q: { en: 'How can I add predefined diamond rates for a particular shape, sieve, color or clarity?', hi: 'किसी particular shape, sieve, color या clarity के लिए predefined diamond rates कैसे add करूं?' }, a: { en: 'Settings → Masters → Diamond → Add Diamond Rates → fill in the required columns to add rates.', hi: 'Settings → Masters → Diamond → Add Diamond Rates → जरूरी columns भरकर rates add करें।' } },
      { q: { en: 'If I have a diamond packet code written on my tag, can I add it?', hi: 'अगर मेरे tag पर diamond packet code लिखा है, तो क्या मैं उसे add कर सकता हूं?' }, a: { en: 'Yes. Settings → Masters → Diamond → Add Diamond Rates → enter the packet code and its rate in the Packet Code column. This rate will be applied automatically whenever the scanner detects this packet code.', hi: 'हां। Settings → Masters → Diamond → Add Diamond Rates → Packet Code column में packet code और उसकी rate डालें। जब भी scanner यह packet code scan करेगा, यह rate automatically लग जाएगी।' } },
      { q: { en: 'What if I have two diamond packet codes on a single piece of jewellery?', hi: 'अगर एक ही जूलरी पर दो diamond packet codes हों तो क्या होगा?' }, a: { en: 'The scanner will automatically detect both diamonds. While calculating MRP, it will show both weights and rates separately.', hi: 'Scanner दोनों diamonds को automatically detect कर लेगा। MRP calculate करते समय दोनों का weight और rate अलग-अलग दिखेगा।' } },
      { q: { en: 'What if I have a predefined rate in my diamond masters, but I want to edit it while calculating MRP for a customer?', hi: 'अगर मेरे diamond masters में predefined rate है, पर मैं customer के हिसाब से MRP calculate करते समय rate बदलना चाहूं तो?' }, a: { en: 'You can always edit the rate while calculating MRP. The scanner fetches the predefined rate from Masters first, but you can change it at that time.', hi: 'MRP calculate करते समय आप हमेशा rate edit कर सकते हैं। Scanner पहले Masters से predefined rate उठाएगा, पर आप उस समय उसे बदल सकते हैं।' } },
    ],
  },
  {
    section: { en: 'Colorstone', hi: 'कलरस्टोन' },
    items: [
      { q: { en: 'What if I have a colorstone on my tag?', hi: 'अगर मेरे tag पर colorstone है तो क्या होगा?' }, a: { en: 'The scanner will automatically detect the colorstone and its weight on scanning. If the rate is written on the tag, it will fetch that — otherwise, the rate will be taken from the backend.', hi: 'Scan करते ही scanner colorstone और उसका weight automatically detect कर लेगा। अगर rate tag पर लिखी है तो वो ले लेगा — नहीं तो rate backend से आएगी।' } },
      { q: { en: 'How do I add predefined colorstone rates?', hi: 'Predefined colorstone rates कैसे add करूं?' }, a: { en: 'Settings → Masters → Colorstone → add your predefined rates there.', hi: 'Settings → Masters → Colorstone → अपनी predefined rates यहां add करें।' } },
      { q: { en: 'How can I edit colorstone rates while calculating MRP?', hi: 'MRP calculate करते समय colorstone rate कैसे edit करूं?' }, a: { en: 'Just change the colorstone rate while calculating MRP — it updates automatically.', hi: 'बस MRP calculate करते समय colorstone rate बदल दें — यह automatically update हो जाएगी।' } },
      { q: { en: 'What if I don’t put a colorstone rate on my tag, and it’s also not in my Masters column?', hi: 'अगर मैं tag पर colorstone rate नहीं डालता, और वो मेरे Masters column में भी नहीं है, तो क्या होगा?' }, a: { en: 'The colorstone will still be detected by the scanner, but the rate column will be empty. Just enter your desired rate, and the MRP will be calculated automatically.', hi: 'Scanner फिर भी colorstone detect कर लेगा, पर rate column खाली रहेगा। बस अपनी मनचाही rate डाल दें, MRP automatically calculate हो जाएगी।' } },
    ],
  },
  {
    section: { en: 'Labour Charge', hi: 'लेबर चार्ज' },
    items: [
      { q: { en: 'What if there is no labour charge written on my tag?', hi: 'अगर मेरे tag पर labour charge नहीं लिखा है तो क्या होगा?' }, a: { en: 'After scanning the tag, the labour charge field will show blank. Just enter your labour rate and select Gross Weight or Net Weight — the labour charge will be calculated automatically.', hi: 'Tag scan करने के बाद labour charge field खाली दिखेगा। बस अपनी labour rate डालें और Gross Weight या Net Weight चुनें — labour charge automatically calculate हो जाएगा।' } },
      { q: { en: 'Can I predefine labour charges for my tags?', hi: 'क्या मैं अपने tags के लिए labour charges predefine कर सकता हूं?' }, a: { en: 'Yes. Settings → Masters → Labour Charges → add your desired labour rate and select Gross Weight or Net Weight. This will be saved in your Masters and used every time you calculate MRP.', hi: 'हां। Settings → Masters → Labour Charges → अपनी मनचाही labour rate डालें और Gross Weight या Net Weight चुनें। यह Masters में save हो जाएगा और हर बार MRP calculate करते समय इस्तेमाल होगा।' } },
    ],
  },
  {
    section: { en: 'Item Code', hi: 'आइटम कोड' },
    items: [
      { q: { en: 'How do I add an item code?', hi: 'Item code कैसे add करूं?' }, a: { en: 'Settings → Masters → Item Code → add your item name and item code. Whenever the scanner scans a matching tag, it will automatically fetch the item name and code and show them on the calculation page.', hi: 'Settings → Masters → Item Code → अपना item name और item code add करें। जब भी scanner matching tag scan करेगा, item name और code automatically calculation page पर दिख जाएंगे।' } },
    ],
  },
  {
    section: { en: 'Generate Invoice', hi: 'इनवॉइस जनरेट करना' },
    items: [
      { q: { en: 'Can I generate an e-invoice from this app?', hi: 'क्या मैं इस app से e-invoice generate कर सकता हूं?' }, a: { en: 'Yes, but you’ll need to submit a few documents required on the GST portal. Email info@mrpscan.com mentioning that you want the e-invoice facility, and our team will connect with you to set it up.', hi: 'हां, पर उसके लिए आपको GST portal पर जरूरी कुछ documents submit करने होंगे। info@mrpscan.com पर email करें कि आपको e-invoice facility चाहिए, हमारी टीम आपसे contact करके इसे शुरू कर देगी।' } },
      { q: { en: 'Can I send my invoice to another person?', hi: 'क्या मैं अपना invoice किसी और को भेज सकता हूं?' }, a: { en: 'Yes. Generate Invoice → Preview → use the sharing option there to send the invoice to your customer.', hi: 'हां। Generate Invoice → Preview → वहां दिए गए sharing option से customer को invoice भेज सकते हैं।' } },
    ],
  },
  {
    section: { en: 'Wishlist', hi: 'विशलिस्ट' },
    items: [
      { q: { en: 'After calculating the MRP, can I add it to my wishlist?', hi: 'MRP calculate करने के बाद, क्या मैं उसे wishlist में add कर सकता हूं?' }, a: { en: 'Yes. Scan your tag, calculate the MRP, and tap Add to Wishlist at the bottom. It will be saved in your wishlist, shown on the Home page — and you can clear it out anytime.', hi: 'हां। Tag scan करें, MRP calculate करें, और नीचे दिए Add to Wishlist पर tap करें। यह आपकी wishlist में save हो जाएगा, जो Home page पर दिखती है — और आप इसे कभी भी clear कर सकते हैं।' } },
    ],
  },
  {
    section: { en: 'Password Manager', hi: 'पासवर्ड मैनेजर' },
    items: [
      { q: { en: 'Can I change my password?', hi: 'क्या मैं अपना password बदल सकता हूं?' }, a: { en: 'Yes, you can always change or update your password. Go to Password Manager and create your new password there.', hi: 'हां, आप हमेशा अपना password बदल या update कर सकते हैं। Password Manager में जाकर अपना नया password बनाएं।' } },
    ],
  },
  {
    section: { en: 'Employee Management', hi: 'एम्प्लॉई मैनेजमेंट' },
    items: [
      { q: { en: 'How can I add an employee to my app?', hi: 'मैं अपने app में employee कैसे add करूं?' }, a: { en: 'Settings → Employee Manager → Add New Employee → fill in their details → Continue. A unique username and password will be generated for them — share it directly from there, and it becomes their login.', hi: 'Settings → Employee Manager → Add New Employee → उनकी details भरें → Continue। उनके लिए एक unique username और password बन जाएगा — इसे वहीं से share कर दें, यही उनका login बन जाएगा।' } },
      { q: { en: 'Can my employee use two different IDs on this app?', hi: 'क्या मेरा employee इस app पर दो अलग-अलग IDs इस्तेमाल कर सकता है?' }, a: { en: 'No — only one login is allowed per employee, tied to one mobile number under your GST license.', hi: 'नहीं — हर employee का सिर्फ एक ही login होगा, जो आपके GST license के तहत एक mobile number से जुड़ा होगा।' } },
      { q: { en: 'How can I control which gold rate tiles are shown to my employee?', hi: 'मैं अपने employee को दिखने वाली gold rate tiles कैसे control करूं?' }, a: { en: 'Settings → Employee Manager → select the employee → Set Permission → Dashboard Matrices → select the gold rates you want them to see. Only the rates you select will show up in their app.', hi: 'Settings → Employee Manager → employee चुनें → Set Permission → Dashboard Matrices → जो gold rates उन्हें दिखानी हैं वो select करें। सिर्फ selected rates ही उनके app में दिखेंगी।' } },
      { q: { en: 'How can I make sure my employee cannot change the gold rates?', hi: 'मैं कैसे पक्का करूं कि मेरा employee gold rates ना बदल सके?' }, a: { en: 'Settings → Employee Manager → select the employee → Set Permission → Give Rate Edit Access → leave Gold unchecked. If it’s unchecked, they won’t be able to edit gold rates.', hi: 'Settings → Employee Manager → employee चुनें → Set Permission → Give Rate Edit Access → Gold को unchecked रहने दें। Unchecked रहने पर वो gold rates edit नहीं कर पाएंगे।' } },
      { q: { en: 'How can I make sure my employee cannot change the diamond rates?', hi: 'मैं कैसे पक्का करूं कि मेरा employee diamond rates ना बदल सके?' }, a: { en: 'Settings → Employee Manager → select the employee → Set Permission → Give Rate Edit Access → leave Diamond unchecked. If it’s checked, they can edit diamond rates — if not, they can’t.', hi: 'Settings → Employee Manager → employee चुनें → Set Permission → Give Rate Edit Access → Diamond को unchecked रहने दें। Checked होने पर वो diamond rates edit कर सकते हैं — नहीं तो नहीं।' } },
      { q: { en: 'How can I make sure my employee cannot change the labour rates?', hi: 'मैं कैसे पक्का करूं कि मेरा employee labour rates ना बदल सके?' }, a: { en: 'Settings → Employee Manager → select the employee → Set Permission → Give Rate Edit Access → leave Labour Charges unchecked to stop them from editing labour rates while calculating MRP.', hi: 'Settings → Employee Manager → employee चुनें → Set Permission → Give Rate Edit Access → Labour Charges को unchecked रखें ताकि वो MRP calculate करते समय labour rates edit ना कर सकें।' } },
      { q: { en: 'How can I make sure my employee sees only RTGS rate, only Cash rate, or both?', hi: 'मैं कैसे पक्का करूं कि मेरा employee सिर्फ RTGS rate, सिर्फ Cash rate, या दोनों देख सके?' }, a: { en: 'Settings → Employee Manager → select the employee → Set Permission → Gold Rate Options While Calculating → choose RTGS Rate Only, Cash Rate Only, or Both. This controls what’s shown in their app.', hi: 'Settings → Employee Manager → employee चुनें → Set Permission → Gold Rate Options While Calculating → RTGS Rate Only, Cash Rate Only, या Both में से चुनें। इससे तय होगा कि उनके app में क्या दिखेगा।' } },
      { q: { en: 'How can I make sure my employee cannot edit the purity percentage while calculating MRP?', hi: 'मैं कैसे पक्का करूं कि मेरा employee MRP calculate करते समय purity percentage edit ना कर सके?' }, a: { en: 'Settings → Employee Manager → select the employee → Set Permission → leave Edit Purity (%) unchecked to stop them from changing the purity percentage while calculating MRP.', hi: 'Settings → Employee Manager → employee चुनें → Set Permission → Edit Purity (%) को unchecked रखें ताकि वो MRP calculate करते समय purity percentage ना बदल सकें।' } },
      { q: { en: 'What if my employee leaves my company?', hi: 'अगर मेरा employee कंपनी छोड़ दे तो क्या करूं?' }, a: { en: 'Settings → Employee Manager → tap the employee’s card → turn off Active Account. All app features will be disabled for that employee’s number.', hi: 'Settings → Employee Manager → employee के card पर tap करें → Active Account को off कर दें। उस employee के number पर app के सारे features disable हो जाएंगे।' } },
    ],
  },
];

const setMenuFaqsBtn = document.getElementById('setMenuFaqs');
const faqList = document.getElementById('faqList');
const faqEmpty = document.getElementById('faqEmpty');
const faqSearchInput = document.getElementById('faqSearchInput');
const faqSearchClear = document.getElementById('faqSearchClear');
const faqLangBtn = document.getElementById('faqLangBtn');
const faqLangMenu = document.getElementById('faqLangMenu');
let faqLang = 'en';

const FAQ_STRINGS = {
  searchPlaceholder: { en: 'Search FAQs', hi: 'सवाल खोजें' },
  emptyState: { en: 'No matching questions found.', hi: 'कोई मिलता-जुलता सवाल नहीं मिला।' },
};

function renderFaqs(sections, opts = {}) {
  faqList.innerHTML = '';
  const hasResults = sections.some((s) => s.items.length > 0);
  faqEmpty.hidden = hasResults;
  faqList.hidden = !hasResults;
  sections.forEach((section) => {
    if (section.items.length === 0) return;
    const card = document.createElement('div');
    card.className = 'faq-section-card';
    card.innerHTML = `
      <button type="button" class="faq-section-head">
        <span class="faq-section-title">${section.section[faqLang]}</span>
        <svg class="faq-section-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="faq-section-body"></div>
    `;
    const sectionHead = card.querySelector('.faq-section-head');
    const sectionBody = card.querySelector('.faq-section-body');
    section.items.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'faq-item';
      row.innerHTML = `
        <button type="button" class="faq-q-head">
          <span class="faq-q-num">${i + 1}.</span>
          <span class="faq-q-text">${item.q[faqLang]}</span>
          <svg class="faq-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="faq-a-body"><p class="faq-a-text">${item.a[faqLang]}</p></div>
      `;
      const qHead = row.querySelector('.faq-q-head');
      const qBody = row.querySelector('.faq-a-body');
      qHead.addEventListener('click', () => {
        const isOpen = qBody.classList.toggle('show');
        qHead.classList.toggle('open', isOpen);
      });
      sectionBody.appendChild(row);
    });
    sectionHead.addEventListener('click', () => {
      const isOpen = sectionBody.classList.toggle('show');
      sectionHead.classList.toggle('open', isOpen);
    });
    if (opts.expandSections) {
      sectionBody.classList.add('show');
      sectionHead.classList.add('open');
    }
    faqList.appendChild(card);
  });
}
renderFaqs(FAQ_SECTIONS);

function filterFaqs() {
  const term = faqSearchInput.value.trim().toLowerCase();
  faqSearchClear.hidden = term.length === 0;
  if (!term) {
    renderFaqs(FAQ_SECTIONS);
    return;
  }
  const filtered = FAQ_SECTIONS.map((section) => ({
    section: section.section,
    items: section.items.filter((item) => item.q[faqLang].toLowerCase().includes(term) || item.a[faqLang].toLowerCase().includes(term)),
  }));
  renderFaqs(filtered, { expandSections: true });
}
faqSearchInput.addEventListener('input', filterFaqs);
faqSearchClear.addEventListener('click', () => {
  faqSearchInput.value = '';
  filterFaqs();
  faqSearchInput.focus();
});

faqLangBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  faqLangMenu.hidden = !faqLangMenu.hidden;
});
document.querySelectorAll('.faq-lang-opt').forEach((opt) => {
  opt.addEventListener('click', () => {
    faqLang = opt.dataset.lang;
    document.querySelectorAll('.faq-lang-opt').forEach((o) => o.classList.toggle('active', o === opt));
    faqLangMenu.hidden = true;
    faqSearchInput.placeholder = FAQ_STRINGS.searchPlaceholder[faqLang];
    faqEmpty.textContent = FAQ_STRINGS.emptyState[faqLang];
    filterFaqs();
  });
});
document.addEventListener('click', (e) => {
  if (!faqLangMenu.hidden && !faqLangMenu.contains(e.target) && e.target !== faqLangBtn) {
    faqLangMenu.hidden = true;
  }
});

setMenuFaqsBtn.addEventListener('click', () => {
  goForward(screenSettings, screenFaqs);
});
document.getElementById('faqsBackBtn').addEventListener('click', () => {
  goBackward(screenFaqs, screenSettings);
});
document.getElementById('pwMgrBackBtn').addEventListener('click', () => {
  goBackward(screenPasswordManager, screenSettings);
});
document.getElementById('pwMgrForgotLink').addEventListener('click', (e) => {
  e.preventDefault();
  forgotPwReturnScreen = screenPasswordManager;
  resetForgotPasswordScreen();
  screenPasswordManager.classList.remove('active');
  screenForgotPassword.classList.remove('exit-right');
  screenForgotPassword.classList.add('active', 'enter-right');
});
wireEyeToggle('togglePwMgrCurrent', 'pwMgrCurrent');
wireEyeToggle('togglePwMgrNew', 'pwMgrNew');
wireEyeToggle('togglePwMgrConfirm', 'pwMgrConfirm');
document.getElementById('pwMgrUpdateBtn').addEventListener('click', () => {
  const newPw = document.getElementById('pwMgrNew');
  const confirmPw = document.getElementById('pwMgrConfirm');
  const newField = newPw.closest('.field');
  const confirmField = confirmPw.closest('.field');
  const errorEl = document.getElementById('pwMgrError');

  const newValid = newPw.value.trim().length >= 6;
  const confirmValid = newValid && confirmPw.value === newPw.value;

  setInvalid(newField, !newValid);
  setInvalid(confirmField, !confirmValid);
  errorEl.classList.toggle('show', newValid && !confirmValid);

  if (!newValid) { newField.scrollIntoView({ behavior: 'smooth', block: 'center' }); shakeField(newField); return; }
  if (!confirmValid) { confirmField.scrollIntoView({ behavior: 'smooth', block: 'center' }); shakeField(confirmField); return; }

  const btn = document.getElementById('pwMgrUpdateBtn');
  btn.textContent = 'Password Updated ✓';
  setTimeout(() => {
    btn.textContent = 'Update Password';
    document.getElementById('pwMgrCurrent').value = '';
    newPw.value = '';
    confirmPw.value = '';
    goBackward(screenPasswordManager, screenSettings);
  }, 1000);
});
document.getElementById('dashSetBackBtn').addEventListener('click', () => {
  goBackward(screenDashSettings, screenSettings);
});

// -- Bhaw rate: LIVE from the real gold-rate-tracker API -> feeds into the Home Gold rate --
// *** This is the exact contract to hand to the backend dev for the real APK: ***
//   GET https://17gdivfex7.execute-api.ap-south-1.amazonaws.com/bhaw
//   -> { source, name, cash_bhaw, rtgs_bhaw, updated_at }   (whichever source is currently active)
// The admin dashboard (https://d2r9p5yl881cyw.cloudfront.net) additionally exposes, on the API root:
//   GET  {ROOT}         -> [{ source, name, selected, ... }]   (full list, for the admin picker)
//   PUT  {ROOT}select   -> { source }                          (admin sets which source is active)
// Dashboard Settings' JMD/Mega Bullion picker below calls those admin endpoints purely so this
// mockup can demo switching sources — MRPscan itself only ever needs the one read-only GET /bhaw.
// Bhaw has no dedicated tile on Home — it's added straight onto the Gold (24K) Cash/RTGS rates.
const BHAW_ROOT_URL = 'https://17gdivfex7.execute-api.ap-south-1.amazonaws.com/';
const BHAW_URL = BHAW_ROOT_URL + 'bhaw';
const GOLD_BASE_CASH = 74320;
const GOLD_BASE_RTGS = 74410;
let bhawPollTimer = null;

function formatRupees(n) {
  return '₹ ' + Math.round(n).toLocaleString('en-IN');
}

function renderBhaw(data) {
  const cashBhaw = Number(data.cash_bhaw) || 0;
  const rtgsBhaw = Number(data.rtgs_bhaw) || 0;
  document.getElementById('dashGoldCashRate').textContent = formatRupees(GOLD_BASE_CASH + cashBhaw);
  document.getElementById('dashGoldRtgsRate').textContent = formatRupees(GOLD_BASE_RTGS + rtgsBhaw);
}

async function fetchBhaw() {
  const res = await fetch(BHAW_URL);
  if (!res.ok) throw new Error('Bhaw API returned ' + res.status);
  return res.json();
}

function startBhawPolling() {
  if (bhawPollTimer) return;
  bhawPollTimer = setInterval(async () => {
    try {
      renderBhaw(await fetchBhaw());
    } catch (e) {
      console.error('Bhaw live refresh failed', e);
    }
  }, 30000);
}

// Reflect the admin dashboard's real current selection on the two radios whenever Dashboard Settings opens.
async function syncBhawSourceCheckboxes() {
  try {
    const res = await fetch(BHAW_ROOT_URL);
    const sources = await res.json();
    sources.forEach((s) => {
      const input = { jmd_patil: bhawSourceJmd, mega_bullion: bhawSourceMega }[s.source];
      if (input) input.checked = !!s.selected;
    });
  } catch (e) {
    console.error('Could not load live Bhaw sources', e);
  }
}

// Only reveal the Home Bhaw tile once the user actually taps a source here —
// 'click' (not 'change') so re-clicking the already-selected option still reveals it.
async function selectBhawSource(sourceKey) {
  try {
    await fetch(BHAW_ROOT_URL + 'select', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: sourceKey }),
    });
    renderBhaw(await fetchBhaw());
    startBhawPolling();
  } catch (e) {
    console.error('Bhaw source selection failed', e);
  }
}

const bhawSourceJmd = document.getElementById('bhawSourceJmd');
const bhawSourceMega = document.getElementById('bhawSourceMega');
bhawSourceJmd.addEventListener('click', () => selectBhawSource('jmd_patil'));
bhawSourceMega.addEventListener('click', () => selectBhawSource('mega_bullion'));
document.getElementById('setMenuDashboard').addEventListener('click', syncBhawSourceCheckboxes);
document.getElementById('setMenuMasters').addEventListener('click', () => {
  goForward(screenSettings, screenMasterRates);
});
document.getElementById('mstRatesBackBtn').addEventListener('click', () => {
  goBackward(screenMasterRates, screenSettings);
});

// -- Masters -> Item Code --
document.getElementById('mstItemCodeRow').addEventListener('click', () => {
  goForward(screenMasterRates, screenItemCode);
});
document.getElementById('itemCodeBackBtn').addEventListener('click', () => {
  goBackward(screenItemCode, screenMasterRates);
});

const ITC_DELETE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0 1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const itcList = document.getElementById('itcList');

function renumberItcRows() {
  [...itcList.querySelectorAll('.itc-row')].forEach((row, i) => {
    row.querySelector('.itc-num').textContent = (i + 1) + '.';
  });
}
function wireItcRow(row) {
  row.querySelector('.itc-icon-btn-danger').addEventListener('click', () => {
    if (itcList.querySelectorAll('.itc-row').length <= 1) return;
    row.remove();
    renumberItcRows();
  });
}
wireItcRow(itcList.querySelector('.itc-row'));

document.getElementById('itcAddBtn').addEventListener('click', () => {
  const row = document.createElement('div');
  row.className = 'itc-row';
  row.innerHTML = `
    <div class="itc-row-body">
      <span class="itc-num"></span>
      <div class="itc-row-fields">
        <label class="itc-field"><span>Item Name</span><input type="text"></label>
        <label class="itc-field"><span>Item Code</span><input type="text"></label>
      </div>
      <button class="itc-icon-btn itc-icon-btn-danger" aria-label="Delete">${ITC_DELETE_ICON}</button>
    </div>
  `;
  itcList.appendChild(row);
  wireItcRow(row);
  renumberItcRows();
  row.querySelector('input').focus();
});

// -- Employee Manager (list -> add -> auto-generated credentials, plus detail edit shortcuts) --
let empMode = 'add'; // 'add' | 'edit' — edit mode always returns straight to the Detail screen
let permReturnScreen = screenEmpList; // Permissions screen returns wherever it was opened from
let pendingEmp = null;

document.getElementById('setMenuEmployees').addEventListener('click', () => {
  goForward(screenSettings, screenEmpList);
});
document.getElementById('empListBackBtn').addEventListener('click', () => {
  goBackward(screenEmpList, screenSettings);
});

function empInitials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}
function wireEmpCard(card) {
  card.addEventListener('click', () => goForward(screenEmpList, screenEmpDetail));
  card.querySelector('.emp-card-perm-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    permReturnScreen = screenEmpList;
    goForward(screenEmpList, screenEmpPermissions);
  });
}
document.querySelectorAll('.emp-card').forEach(wireEmpCard);

document.getElementById('empAddFab').addEventListener('click', () => {
  empMode = 'add';
  document.getElementById('empAddTitle').textContent = 'Add New Employee';
  document.getElementById('empName').value = '';
  document.getElementById('empPhone').value = '';
  document.getElementById('empEmail').value = '';
  document.getElementById('empDesignation').value = '';
  goForward(screenEmpList, screenEmpAdd);
});
document.getElementById('empAddBackBtn').addEventListener('click', () => {
  goBackward(screenEmpAdd, empMode === 'edit' ? screenEmpDetail : screenEmpList);
});
document.getElementById('empAddContinueBtn').addEventListener('click', () => {
  if (empMode === 'edit') {
    goBackward(screenEmpAdd, screenEmpDetail);
    return;
  }
  const name = document.getElementById('empName').value.trim() || 'New Employee';
  const designation = document.getElementById('empDesignation').value.trim() || 'Employee';
  const firstName = (name.split(' ')[0] || 'user').toLowerCase().replace(/[^a-z]/g, '') || 'user';
  const username = firstName + Math.floor(100 + Math.random() * 900);
  const password = 'Mrp@' + Math.floor(1000 + Math.random() * 9000);
  pendingEmp = { name, designation };
  document.getElementById('empCredUsername').textContent = username;
  document.getElementById('empCredPassword').textContent = password;
  goForward(screenEmpAdd, screenEmpCredentials);
});

document.getElementById('empCredBackBtn').addEventListener('click', () => {
  goBackward(screenEmpCredentials, screenEmpAdd);
});
document.getElementById('empCredShareBtn').addEventListener('click', () => {
  const u = document.getElementById('empCredUsername').textContent;
  const p = document.getElementById('empCredPassword').textContent;
  openShareSheet('Your MRPscan login — Username: ' + u + ', Password: ' + p);
});
document.getElementById('empCredContinueBtn').addEventListener('click', () => {
  if (pendingEmp) {
    const card = document.createElement('div');
    card.className = 'emp-card';
    card.innerHTML = `
      <div class="emp-avatar">${empInitials(pendingEmp.name)}</div>
      <div class="emp-card-info"><span class="emp-card-name">${pendingEmp.name}</span><span class="emp-card-desig">${pendingEmp.designation}</span></div>
      <button type="button" class="emp-card-perm-btn">Set Permission</button>
    `;
    document.getElementById('empCards').appendChild(card);
    wireEmpCard(card);
    pendingEmp = null;
  }
  goBackward(screenEmpCredentials, screenEmpList);
});

document.getElementById('empPermBackBtn').addEventListener('click', () => {
  goBackward(screenEmpPermissions, permReturnScreen);
});
document.getElementById('empPermContinueBtn').addEventListener('click', () => {
  goBackward(screenEmpPermissions, permReturnScreen);
});

// -- Permissions dropdowns (multi-select checkbox groups + single-select radio group) --
function wirePermDropdown(key) {
  const head = document.querySelector(`[data-dropdown="${key}"]`);
  const body = document.getElementById(key + 'Body');
  head.addEventListener('click', () => {
    const isOpen = body.classList.toggle('show');
    head.classList.toggle('open', isOpen);
  });
}
['permGoldMatrix', 'permRateEdit', 'permRateOpt'].forEach(wirePermDropdown);

document.getElementById('empPasswordBackBtn').addEventListener('click', () => {
  goBackward(screenEmpPassword, screenEmpDetail);
});
document.getElementById('empPasswordSubmitBtn').addEventListener('click', () => {
  goBackward(screenEmpPassword, screenEmpDetail);
});
wireEyeToggle('toggleEmpPassword1', 'empPassword1');
wireEyeToggle('toggleEmpPassword2', 'empPassword2');

document.getElementById('empDetailBackBtn').addEventListener('click', () => {
  goBackward(screenEmpDetail, screenEmpList);
});
document.getElementById('empEditBtn').addEventListener('click', () => {
  empMode = 'edit';
  document.getElementById('empAddTitle').textContent = 'Edit Employee';
  goForward(screenEmpDetail, screenEmpAdd);
});
document.getElementById('empPasswordEditBtn').addEventListener('click', () => {
  goForward(screenEmpDetail, screenEmpPassword);
});
document.getElementById('empPermEditBtn').addEventListener('click', () => {
  permReturnScreen = screenEmpDetail;
  goForward(screenEmpDetail, screenEmpPermissions);
});
document.getElementById('empDeleteBtn').addEventListener('click', () => {
  if (confirm('Are you sure you want to delete this employee? This will permanently remove their details.')) {
    goBackward(screenEmpDetail, screenEmpList);
  }
});
document.getElementById('empStatusToggle').addEventListener('change', function () {
  const title = document.getElementById('empStatusTitle');
  const sub = document.getElementById('empStatusSub');
  if (this.checked) {
    title.textContent = 'Active Account';
    sub.textContent = 'Employee can log in and use the app.';
  } else {
    title.textContent = 'Account Revoked';
    sub.textContent = 'Employee cannot log in until reactivated.';
  }
});

// -- Business Profile (from Settings screen's profile banner) --
document.getElementById('setProfileBanner').addEventListener('click', () => {
  goForward(screenSettings, screenBizProfile);
});
document.getElementById('bizProfileBackBtn').addEventListener('click', () => {
  goBackward(screenBizProfile, screenSettings);
});

// -- Wishlist (from Home's Wishlist button) --
document.getElementById('dashWishlistBtn').addEventListener('click', () => {
  goForward(currentScreen, screenWishlist);
});

// -- Notifications --
document.getElementById('dashNotifBtn').addEventListener('click', () => {
  goForward(currentScreen, screenNotifications);
  document.getElementById('dashBellDot').classList.remove('show');
  document.querySelectorAll('.notif-card.notif-unread').forEach((c) => c.classList.remove('notif-unread'));
});
document.getElementById('notifBackBtn').addEventListener('click', () => {
  goBackward(screenNotifications, screenHome);
});
document.getElementById('wishlistCloseBtn').addEventListener('click', () => {
  goBackward(screenWishlist, screenHome);
});

// -- Subscription (from Home's trial tile) --
function openSubscription() {
  goForward(currentScreen, screenSubscription);
}
document.getElementById('dashTrialTile').addEventListener('click', openSubscription);
document.getElementById('dashPurchaseBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  openSubscription();
});
document.getElementById('subBackBtn').addEventListener('click', () => {
  goBackward(screenSubscription, screenHome);
});
document.getElementById('subKeepUsingBtn').addEventListener('click', () => {
  goBackward(screenSubscription, screenHome);
});
document.getElementById('subPurchaseBtn').addEventListener('click', function () {
  const original = this.textContent;
  this.textContent = 'Redirecting to Razorpay…';
  this.disabled = true;
  setTimeout(() => {
    window.open('https://razorpay.com', '_blank');
    this.textContent = original;
    this.disabled = false;
  }, 700);
});

const wishlistList = document.getElementById('wishlistList');
const wishlistEmpty = document.getElementById('wishlistEmpty');

function checkWishlistEmpty() {
  wishlistEmpty.classList.toggle('show', wishlistList.querySelectorAll('.wl-card').length === 0);
}

wishlistList.querySelectorAll('.wl-card').forEach((card) => {
  card.addEventListener('click', () => goForward(screenWishlist, screenScanReview));
  card.querySelector('.wl-delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to remove this item from your wishlist?')) {
      card.remove();
      checkWishlistEmpty();
    }
  });
});

document.getElementById('wishlistClearLink').addEventListener('click', (e) => {
  e.preventDefault();
  if (!wishlistList.querySelector('.wl-card')) return;
  if (confirm('Are you sure you want to remove all items from your wishlist?')) {
    wishlistList.innerHTML = '';
    checkWishlistEmpty();
  }
});

window.addEventListener('load', playSplash);
