const ACTIVE_USER_KEY = 'meplanes.challenge-tracker.active-user';
const TRACKER_URL = 'tracker.html';

const buttons = document.querySelectorAll('[data-login-user]');

function setActiveUser(userId) {
  try {
    sessionStorage.setItem(ACTIVE_USER_KEY, userId);
  } catch {
    /* sessionStorage unavailable */
  }
}

buttons.forEach((button) => {
  button.addEventListener('click', () => {
    setActiveUser(button.getAttribute('data-login-user'));
    window.location.href = TRACKER_URL;
  });
});
