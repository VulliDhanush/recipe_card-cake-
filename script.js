document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================================================
  // STATE DATA
  // ==========================================================================
  const RECIPE_STATE = {
    baseServings: 8,
    currentServings: 8,
    currentStepIndex: 0,
    totalSteps: 6,
    isCookingMode: false,
    
    // Timer states
    timerDuration: 600, // in seconds
    timerRemaining: 600,
    timerRunning: false,
    timerId: null
  };

  // ==========================================================================
  // DOM ELEMENT SELECTORS
  // ==========================================================================
  // Collapsibles
  const btnToggleIngredients = document.getElementById('btn-toggle-ingredients');
  const ingredientsBody = document.getElementById('ingredients-collapse-body');
  const btnToggleInstructions = document.getElementById('btn-toggle-instructions');
  const instructionsBody = document.getElementById('instructions-collapse-body');

  // Servings Calculator
  const btnDecreaseServings = document.getElementById('btn-decrease-servings');
  const btnIncreaseServings = document.getElementById('btn-increase-servings');
  const servingsCountDisplay = document.getElementById('servings-count');
  const currentServingsText = document.getElementById('current-servings-text');
  const qtyElements = document.querySelectorAll('.ingredient-qty');

  // Cooking Focus Overlay
  const btnStartCooking = document.getElementById('btn-start-cooking');
  const btnCloseFocus = document.getElementById('btn-close-focus');
  const cookingOverlay = document.getElementById('cooking-focus-overlay');
  
  // Cooking Progress & Navigation
  const focusStepNum = document.getElementById('focus-step-num');
  const focusTotalSteps = document.getElementById('focus-total-steps');
  const cookingProgressBar = document.getElementById('cooking-progress-bar');
  const focusStepTitle = document.getElementById('focus-step-title');
  const focusStepDesc = document.getElementById('focus-step-desc');
  const focusStepBadge = document.getElementById('focus-step-badge');
  const btnFocusPrev = document.getElementById('btn-focus-prev');
  const btnFocusNext = document.getElementById('btn-focus-next');
  
  // Timer Elements
  const timerTimeDisplay = document.getElementById('timer-time-display');
  const btnTimerToggle = document.getElementById('btn-timer-toggle');
  const btnTimerReset = document.getElementById('btn-timer-reset');
  const timerProgressRing = document.getElementById('timer-progress-ring');
  const timerPlayIcon = document.getElementById('timer-play-icon');
  const timerPauseIcon = document.getElementById('timer-pause-icon');
  const timerCard = document.querySelector('.timer-card');

  // Print Action
  const btnPrintRecipe = document.getElementById('btn-print-recipe');

  // Celebration Overlay
  const celebrationOverlay = document.getElementById('celebration-overlay');
  const btnCloseCelebration = document.getElementById('btn-close-celebration');

  // SVG Circumference constant for Timer Ring (2 * PI * r, r = 45)
  const TIMER_CIRCUMFERENCE = 2 * Math.PI * 45; // ~282.74

  // Setup initial timer ring state
  if (timerProgressRing) {
    timerProgressRing.style.strokeDasharray = `${TIMER_CIRCUMFERENCE} ${TIMER_CIRCUMFERENCE}`;
    timerProgressRing.style.strokeDashoffset = 0;
  }

  // ==========================================================================
  // INGREDIENTS MULTIPLIER / CALCULATOR LOGIC
  // ==========================================================================
  
  // Formatter to translate floating decimals into clean fraction symbols (baking standard)
  function formatFraction(amount) {
    if (amount <= 0) return '0';
    
    // Clean up floats
    const rounded = Math.round(amount * 100) / 100;
    const integerPart = Math.floor(rounded);
    const decimalPart = rounded - integerPart;

    let fractionSymbol = '';
    
    // Check approximate fractions commonly used in kitchen volumes
    if (Math.abs(decimalPart - 0.25) < 0.05) {
      fractionSymbol = '¼';
    } else if (Math.abs(decimalPart - 0.5) < 0.05) {
      fractionSymbol = '½';
    } else if (Math.abs(decimalPart - 0.75) < 0.05) {
      fractionSymbol = '¾';
    } else if (Math.abs(decimalPart - 0.33) < 0.05) {
      fractionSymbol = '⅓';
    } else if (Math.abs(decimalPart - 0.67) < 0.05) {
      fractionSymbol = '⅔';
    } else if (decimalPart > 0) {
      // Return normal floating decimal rounded to 1 place if clean, else 2
      const decValue = Math.round(decimalPart * 10) / 10;
      if (decValue > 0) {
        return (integerPart + decimalPart).toFixed(decimalPart === Math.round(decimalPart) ? 0 : 1);
      }
    }

    if (integerPart === 0) {
      return fractionSymbol || rounded.toString();
    } else {
      return fractionSymbol ? `${integerPart} ${fractionSymbol}` : integerPart.toString();
    }
  }

  function updateServings(newServings) {
    if (newServings < 1 || newServings > 32) return; // limit serving range
    
    RECIPE_STATE.currentServings = newServings;
    servingsCountDisplay.textContent = newServings;
    currentServingsText.textContent = `${newServings} servings`;
    
    const factor = newServings / RECIPE_STATE.baseServings;

    // Scale all ingredient amounts
    qtyElements.forEach(el => {
      const baseVal = parseFloat(el.getAttribute('data-base'));
      if (!isNaN(baseVal)) {
        const scaledVal = baseVal * factor;
        el.textContent = formatFraction(scaledVal);
      }
    });
  }

  // Bind Servings buttons
  btnDecreaseServings.addEventListener('click', () => {
    updateServings(RECIPE_STATE.currentServings - 2); // Step down by 2
  });

  btnIncreaseServings.addEventListener('click', () => {
    updateServings(RECIPE_STATE.currentServings + 2); // Step up by 2
  });


  // ==========================================================================
  // SECTION COLLAPSIBLE PANELS LOGIC
  // ==========================================================================
  function setupCollapsible(trigger, body) {
    trigger.addEventListener('click', () => {
      const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
      
      if (isExpanded) {
        trigger.setAttribute('aria-expanded', 'false');
        body.classList.remove('expanded');
      } else {
        trigger.setAttribute('aria-expanded', 'true');
        body.classList.add('expanded');
      }
    });
  }

  setupCollapsible(btnToggleIngredients, ingredientsBody);
  setupCollapsible(btnToggleInstructions, instructionsBody);


  // ==========================================================================
  // STEP-BY-STEP KITCHEN FOCUS MODE LOGIC
  // ==========================================================================
  const stepCards = document.querySelectorAll('.step-card');
  RECIPE_STATE.totalSteps = stepCards.length;

  function highlightMainStep(index) {
    stepCards.forEach((card, i) => {
      if (i === index) {
        card.classList.add('active-cooking');
        // Scroll step into view smoothly on main page
        if (!RECIPE_STATE.isCookingMode) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        card.classList.remove('active-cooking');
      }
    });
  }

  function syncFocusStep() {
    const activeStepEl = document.getElementById(`step-${RECIPE_STATE.currentStepIndex}`);
    if (!activeStepEl) return;

    // Extract step details from main page DOM
    const title = activeStepEl.querySelector('.step-title').textContent;
    const desc = activeStepEl.querySelector('.step-text').textContent;
    const duration = parseInt(activeStepEl.getAttribute('data-duration')) || 300;

    // Update Focus Overlay Elements
    focusStepNum.textContent = RECIPE_STATE.currentStepIndex + 1;
    focusStepBadge.textContent = `Active Step ${RECIPE_STATE.currentStepIndex + 1}`;
    focusStepTitle.textContent = title;
    focusStepDesc.textContent = desc;
    focusTotalSteps.textContent = RECIPE_STATE.totalSteps;

    // Update Progress Bar width
    const progressPercent = ((RECIPE_STATE.currentStepIndex + 1) / RECIPE_STATE.totalSteps) * 100;
    cookingProgressBar.style.width = `${progressPercent}%`;

    // Disable/Enable nav buttons
    btnFocusPrev.disabled = RECIPE_STATE.currentStepIndex === 0;
    
    // Customize label of next button on final step
    if (RECIPE_STATE.currentStepIndex === RECIPE_STATE.totalSteps - 1) {
      btnFocusNext.innerHTML = `Finish Cooking <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else {
      btnFocusNext.innerHTML = `Next Step <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
    }

    // Highlight corresponding background step
    highlightMainStep(RECIPE_STATE.currentStepIndex);

    // Setup active kitchen timer
    stopTimerInterval();
    RECIPE_STATE.timerDuration = duration;
    RECIPE_STATE.timerRemaining = duration;
    updateTimerUI();
  }

  function startCookingFocusMode() {
    RECIPE_STATE.isCookingMode = true;
    RECIPE_STATE.currentStepIndex = 0;
    
    // Ensure section is expanded on main page so user can track
    if (btnToggleInstructions.getAttribute('aria-expanded') === 'false') {
      btnToggleInstructions.click();
    }
    
    syncFocusStep();
    cookingOverlay.classList.add('active');
  }

  function exitCookingFocusMode() {
    RECIPE_STATE.isCookingMode = false;
    stopTimerInterval();
    cookingOverlay.classList.remove('active');
  }

  btnStartCooking.addEventListener('click', startCookingFocusMode);
  btnCloseFocus.addEventListener('click', exitCookingFocusMode);

  // Focus Navigation Clicks
  btnFocusPrev.addEventListener('click', () => {
    if (RECIPE_STATE.currentStepIndex > 0) {
      RECIPE_STATE.currentStepIndex--;
      syncFocusStep();
    }
  });

  btnFocusNext.addEventListener('click', () => {
    if (RECIPE_STATE.currentStepIndex < RECIPE_STATE.totalSteps - 1) {
      RECIPE_STATE.currentStepIndex++;
      syncFocusStep();
    } else {
      // We are on the final step and clicked finish!
      exitCookingFocusMode();
      triggerCelebration();
    }
  });


  // ==========================================================================
  // COUNTDOWN TIMER LOGIC
  // ==========================================================================
  function updateTimerUI() {
    // Format minutes and seconds
    const mins = Math.floor(RECIPE_STATE.timerRemaining / 60);
    const secs = RECIPE_STATE.timerRemaining % 60;
    timerTimeDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    // Update Progress Ring SVG
    const percentRemaining = RECIPE_STATE.timerRemaining / RECIPE_STATE.timerDuration;
    const offset = percentRemaining * TIMER_CIRCUMFERENCE;
    // Set ring dashoffset
    timerProgressRing.style.strokeDashoffset = TIMER_CIRCUMFERENCE - offset;

    // Red pulse styling when time runs low (under 10s)
    if (RECIPE_STATE.timerRemaining <= 0) {
      timerCard.classList.add('timer-finished');
    } else {
      timerCard.classList.remove('timer-finished');
    }
  }

  function startTimerInterval() {
    if (RECIPE_STATE.timerRunning) return;
    
    RECIPE_STATE.timerRunning = true;
    timerPlayIcon.classList.add('hidden');
    timerPauseIcon.classList.remove('hidden');

    RECIPE_STATE.timerId = setInterval(() => {
      if (RECIPE_STATE.timerRemaining > 0) {
        RECIPE_STATE.timerRemaining--;
        updateTimerUI();
      } else {
        // Timer complete!
        stopTimerInterval();
        playAlertSound();
      }
    }, 1000);
  }

  function stopTimerInterval() {
    RECIPE_STATE.timerRunning = false;
    timerPlayIcon.classList.remove('hidden');
    timerPauseIcon.classList.add('hidden');
    
    if (RECIPE_STATE.timerId) {
      clearInterval(RECIPE_STATE.timerId);
      RECIPE_STATE.timerId = null;
    }
  }

  function playAlertSound() {
    // Elegant Web Audio API Beep (avoids loading external audio file dependency)
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Triple short kitchen timer beep
      const playBeep = (time, freq) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3, time + 0.05);
        gain.gain.linearRampToValueAtTime(0, time + 0.25);
        
        osc.start(time);
        osc.stop(time + 0.3);
      };

      const now = audioCtx.currentTime;
      playBeep(now, 880);
      playBeep(now + 0.4, 880);
      playBeep(now + 0.8, 880);
    } catch (e) {
      console.warn("Audio Context not supported or allowed: ", e);
    }

    // Flash timer card UI red
    let flashCount = 0;
    const interval = setInterval(() => {
      timerCard.classList.toggle('timer-alert-flash');
      flashCount++;
      if (flashCount >= 8) {
        clearInterval(interval);
        timerCard.classList.remove('timer-alert-flash');
      }
    }, 250);
  }

  btnTimerToggle.addEventListener('click', () => {
    if (RECIPE_STATE.timerRunning) {
      stopTimerInterval();
    } else {
      startTimerInterval();
    }
  });

  btnTimerReset.addEventListener('click', () => {
    stopTimerInterval();
    RECIPE_STATE.timerRemaining = RECIPE_STATE.timerDuration;
    updateTimerUI();
  });


  // ==========================================================================
  // CONFETTI CELEBRATION CANVAS LOGIC
  // ==========================================================================
  let confettiCanvas = null;
  let confettiCtx = null;
  let confettiParticles = [];
  let confettiAnimationId = null;

  function triggerCelebration() {
    celebrationOverlay.classList.add('active');
    setupConfettiCanvas();
    startConfettiAnimation();
  }

  function setupConfettiCanvas() {
    // Check if canvas exists, if not create and inject
    if (!confettiCanvas) {
      confettiCanvas = document.createElement('canvas');
      confettiCanvas.style.position = 'fixed';
      confettiCanvas.style.top = '0';
      confettiCanvas.style.left = '0';
      confettiCanvas.style.width = '100vw';
      confettiCanvas.style.height = '100vh';
      confettiCanvas.style.pointerEvents = 'none';
      confettiCanvas.style.zIndex = '2001';
      celebrationOverlay.appendChild(confettiCanvas);
      confettiCtx = confettiCanvas.getContext('2d');
    }

    // Set dimensions
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    // Generate colors: terracotta, gold, success-green, chocolate brown, pink
    const colors = ['#D76F30', '#EFA05D', '#4D8061', '#FAF8F5', '#FFB7B2', '#462A27'];

    // Generate particle objects
    confettiParticles = [];
    for (let i = 0; i < 150; i++) {
      confettiParticles.push({
        x: Math.random() * confettiCanvas.width,
        y: Math.random() * -confettiCanvas.height - 20, // start above viewport
        radius: Math.random() * 4 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedY: Math.random() * 4 + 4,
        speedX: Math.random() * 3 - 1.5,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 4 - 2
      });
    }
  }

  function startConfettiAnimation() {
    if (confettiAnimationId) {
      cancelAnimationFrame(confettiAnimationId);
    }
    
    function anim() {
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      
      let particlesRunning = 0;
      
      confettiParticles.forEach(p => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.rotationSpeed;
        
        // Loop back up if it falls off screen and celebration overlay is still active
        if (p.y > confettiCanvas.height) {
          if (celebrationOverlay.classList.contains('active')) {
            p.y = -20;
            p.x = Math.random() * confettiCanvas.width;
          } else {
            return; // stop updating
          }
        }
        
        particlesRunning++;
        
        confettiCtx.save();
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.rotation * Math.PI / 180);
        confettiCtx.fillStyle = p.color;
        
        // Draw confetti rectangle or circle
        if (p.radius > 6) {
          confettiCtx.fillRect(-p.radius, -p.radius/2, p.radius * 2, p.radius);
        } else {
          confettiCtx.beginPath();
          confettiCtx.arc(0, 0, p.radius, 0, Math.PI * 2);
          confettiCtx.fill();
        }
        
        confettiCtx.restore();
      });

      if (particlesRunning > 0) {
        confettiAnimationId = requestAnimationFrame(anim);
      }
    }

    anim();
  }

  btnCloseCelebration.addEventListener('click', () => {
    celebrationOverlay.classList.remove('active');
    if (confettiAnimationId) {
      cancelAnimationFrame(confettiAnimationId);
      confettiAnimationId = null;
    }
    if (confettiCtx && confettiCanvas) {
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  });

  // Handle Window Resize for Confetti
  window.addEventListener('resize', () => {
    if (confettiCanvas && celebrationOverlay.classList.contains('active')) {
      confettiCanvas.width = window.innerWidth;
      confettiCanvas.height = window.innerHeight;
    }
  });


  // ==========================================================================
  // PRINT RECIPE TRIGGER
  // ==========================================================================
  btnPrintRecipe.addEventListener('click', () => {
    window.print();
  });

});
