// === Login ===
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const error = document.getElementById('loginError');

  if (!email.endsWith('@motorway.co.uk')) {
    error.textContent = 'Please use a @motorway.co.uk email address';
    return false;
  }

  if (password !== 'fastlane') {
    error.textContent = 'Incorrect password';
    return false;
  }

  error.textContent = '';
  // Store session with 12-hour expiry
  const expiry = Date.now() + (12 * 60 * 60 * 1000);
  sessionStorage.setItem('auth_expiry', expiry.toString());
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('dashboard-screen').classList.add('active');
  return false;
}

// Check session on load
(function checkAuth() {
  const expiry = sessionStorage.getItem('auth_expiry');
  if (expiry && Date.now() < parseInt(expiry)) {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('dashboard-screen').classList.add('active');
  }
})();

// === State ===
const state = {
  damages: [],
  currentDamage: null,
  isDrawing: false,
  drawStart: { x: 0, y: 0 },
  isPanning: false,
  panMode: false,
  panStart: { x: 0, y: 0 },
  panOffset: { x: 0, y: 0 },
  zoom: 1,
  selectedType: null,
  selectedSize: null,
  pinLocation: null,
  damageCounter: 0,
  editingDamageId: null,
  selectedPanel: null,
  aiSuggestionsShown: false,
  aiSuggestions: []
};

// === DOM Elements ===
const screens = {
  dashboard: document.getElementById('dashboard-screen'),
  damageModal: document.getElementById('damage-modal'),
  markDamage: document.getElementById('mark-damage-screen')
};

const imageContainer = document.getElementById('imageContainer');
const damageImage = document.getElementById('damageImage');
const drawingRect = document.getElementById('drawingRect');
const damageRectangles = document.getElementById('damageRectangles');
const damageList = document.getElementById('damageList');
const damageSidebar = document.getElementById('damageSidebar');
const panZoomBtn = document.getElementById('panZoomBtn');
const addDamageBtn = document.getElementById('addDamageBtn');
const addAndSaveBtn = document.getElementById('addAndSaveBtn');
const damageTypeSelect = document.getElementById('damageTypeSelect');
const damageTypeDropdown = document.getElementById('damageTypeDropdown');
const damageTypeText = document.getElementById('damageTypeText');
const vehicleDiagram = document.getElementById('vehicleDiagram');
const damagePinMarker = document.getElementById('damagePinMarker');
const formDamageRect = document.getElementById('formDamageRect');

// === Screen Navigation ===
function showScreen(screenId) {
  // Hide dashboard when showing modals
  if (screenId === 'dashboard') {
    screens.dashboard.classList.add('active');
    screens.damageModal.classList.remove('active');
    screens.markDamage.classList.remove('active');
  } else if (screenId === 'damageModal') {
    screens.dashboard.classList.remove('active');
    screens.markDamage.classList.remove('active');
    screens.damageModal.classList.add('active');
  } else if (screenId === 'markDamage') {
    screens.dashboard.classList.remove('active');
    screens.damageModal.classList.remove('active');
    screens.markDamage.classList.add('active');
  }
}

function transitionToMarkDamage() {
  screens.damageModal.classList.add('slide-out');
  setTimeout(() => {
    screens.damageModal.classList.remove('active', 'slide-out');
    screens.markDamage.classList.add('active', 'slide-in');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        screens.markDamage.classList.remove('slide-in');
      });
    });
  }, 250);
}

function transitionToDamageModal() {
  screens.markDamage.querySelector('.modal-content-area').style.opacity = '0';
  screens.markDamage.querySelector('.modal-content-area').style.transform = 'translateY(20px)';
  setTimeout(() => {
    screens.markDamage.classList.remove('active');
    screens.markDamage.querySelector('.modal-content-area').style.opacity = '';
    screens.markDamage.querySelector('.modal-content-area').style.transform = '';
    screens.damageModal.classList.add('active');
    // Reset zoom back out
    state.zoom = 1;
    state.panOffset = { x: 0, y: 0 };
    updateImageTransform();
    panZoomBtn.style.opacity = '1';
    panZoomBtn.style.pointerEvents = 'auto';
  }, 250);
}

function openDamageModal() {
  currentPhotoIndex = 0;
  showScreen('damageModal');
  document.getElementById('modalPhotoTitle').textContent = photoAngles[currentPhotoIndex].name;
  damageImage.src = photoAngles[currentPhotoIndex].src;
  state.damages = savedDamages.filter(d => d.photoIndex === currentPhotoIndex);

  // Add AI suggestions on first open for first photo
  if (!state.aiSuggestionsShown) {
    state.aiSuggestionsShown = true;
    state.aiSuggestions = [
      { id: 'ai-1', type: 'Dent', size: 'Large', location: 'Driver door', isAi: true, photoIndex: 0, rect: { leftPct: 12.8, topPct: 50.6, widthPct: 6.8, heightPct: 7.1 }, crop: { x: 0.128, y: 0.506, w: 0.068, h: 0.071 } },
      { id: 'ai-2', type: 'Scratch or scuff', size: 'Small', location: 'Front wing', isAi: true, photoIndex: 0, rect: { leftPct: 29.4, topPct: 50.2, widthPct: 8.7, heightPct: 8.9 }, crop: { x: 0.294, y: 0.502, w: 0.087, h: 0.089 } },
      { id: 'ai-3', type: 'Broken or missing trim', size: 'Small', location: 'Front bumper', isAi: true, photoIndex: 0, rect: { leftPct: 57.2, topPct: 82.6, widthPct: 6.8, heightPct: 7.1 }, crop: { x: 0.572, y: 0.826, w: 0.068, h: 0.071 } }
    ];
  }

  renderDamageList();
  renderDamageRectangles();
  // Reset zoom button visibility
  panZoomBtn.style.opacity = '1';
  panZoomBtn.style.pointerEvents = 'auto';
  // Reset zoom and pan
  state.zoom = 1;
  state.panOffset = { x: 0, y: 0 };
  const wrapper = document.getElementById('imageTransformWrapper');
  wrapper.style.transform = '';
}

function closeDamageModal() {
  showScreen('dashboard');
  // Reset zoom state
  state.zoom = 1;
  state.panOffset = { x: 0, y: 0 };
  const wrapper = document.getElementById('imageTransformWrapper');
  if (wrapper) wrapper.style.transform = '';
  imageContainer.style.cursor = 'crosshair';
  state.panMode = false;
}

function goBackToDamage() {
  resetMarkDamageForm();
  transitionToDamageModal();
}

// === Drawing Damage Rectangles ===
imageContainer.addEventListener('mousedown', (e) => {
  if (state.panMode) {
    state.isPanning = true;
    state.panStart = { x: e.clientX - state.panOffset.x, y: e.clientY - state.panOffset.y };
    imageContainer.style.cursor = 'grabbing';
    return;
  }

  const rect = imageContainer.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  state.isDrawing = true;
  state.drawStart = { x, y };

  drawingRect.style.left = x + 'px';
  drawingRect.style.top = y + 'px';
  drawingRect.style.width = '0px';
  drawingRect.style.height = '0px';
  drawingRect.style.display = 'block';
});

document.addEventListener('mousemove', (e) => {
  if (state.isPanning) {
    state.panOffset.x = e.clientX - state.panStart.x;
    state.panOffset.y = e.clientY - state.panStart.y;
    clampPan();
    updateImageTransform();
    return;
  }

  if (!state.isDrawing) return;

  const rect = imageContainer.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Free-form rectangle - any aspect ratio
  const left = Math.min(state.drawStart.x, x);
  const top = Math.min(state.drawStart.y, y);
  const width = Math.abs(x - state.drawStart.x);
  const height = Math.abs(y - state.drawStart.y);

  drawingRect.style.left = left + 'px';
  drawingRect.style.top = top + 'px';
  drawingRect.style.width = width + 'px';
  drawingRect.style.height = height + 'px';
});

document.addEventListener('mouseup', (e) => {
  if (state.isPanning) {
    state.isPanning = false;
    imageContainer.style.cursor = state.panMode ? 'grab' : 'crosshair';
    return;
  }

  if (!state.isDrawing) return;
  state.isDrawing = false;

  const width = parseInt(drawingRect.style.width);
  const height = parseInt(drawingRect.style.height);

  if (width > 10 && height > 10) {
    const containerRect = imageContainer.getBoundingClientRect();
    const left = parseInt(drawingRect.style.left);
    const top = parseInt(drawingRect.style.top);

    // Store rect as percentages of the container for consistent rendering
    state.currentDamage = {
      rect: {
        leftPct: left / containerRect.width * 100,
        topPct: top / containerRect.height * 100,
        widthPct: width / containerRect.width * 100,
        heightPct: height / containerRect.height * 100
      },
      // Store as fractions of the visible image area for cropping
      crop: {
        x: left / containerRect.width,
        y: top / containerRect.height,
        w: width / containerRect.width,
        h: height / containerRect.height
      }
    };

    // Set up the cropped preview
    showFormPreview();

    // Transition to mark damage screen with animation
    drawingRect.style.display = 'none';
    transitionToMarkDamage();
  } else {
    drawingRect.style.display = 'none';
  }
});

// === Pan & Zoom ===
panZoomBtn.addEventListener('click', () => {
  state.panMode = !state.panMode;
  if (state.panMode) {
    imageContainer.style.cursor = 'grab';
    panZoomBtn.style.background = 'rgba(255, 225, 76, 0.3)';
  } else {
    imageContainer.style.cursor = 'crosshair';
    panZoomBtn.style.background = 'rgba(36, 36, 36, 0.8)';
  }
});

imageContainer.addEventListener('wheel', (e) => {
  e.preventDefault();

  // If zoomed in and it's a regular scroll (not pinch), pan the image
  if (state.zoom > 1 && !e.ctrlKey) {
    const rect = imageContainer.getBoundingClientRect();
    const containerW = rect.width;
    const containerH = rect.height;
    const minOffsetX = containerW - containerW * state.zoom;
    const minOffsetY = containerH - containerH * state.zoom;

    state.panOffset.x = Math.min(0, Math.max(minOffsetX, state.panOffset.x - e.deltaX));
    state.panOffset.y = Math.min(0, Math.max(minOffsetY, state.panOffset.y - e.deltaY));
    updateImageTransform();
    return;
  }

  // Zoom (pinch or scroll at 1x)
  const prevZoom = state.zoom;
  const delta = e.ctrlKey
    ? (e.deltaY > 0 ? -0.3 : 0.3)
    : (e.deltaY > 0 ? -0.15 : 0.15);
  const newZoom = Math.max(1, Math.min(4, state.zoom + delta));

  if (newZoom === prevZoom) return;

  const rect = imageContainer.getBoundingClientRect();
  const containerW = rect.width;
  const containerH = rect.height;
  const cursorX = e.clientX - rect.left;
  const cursorY = e.clientY - rect.top;

  const imgX = (cursorX - state.panOffset.x) / prevZoom;
  const imgY = (cursorY - state.panOffset.y) / prevZoom;

  let newOffsetX = cursorX - imgX * newZoom;
  let newOffsetY = cursorY - imgY * newZoom;

  const minOffsetX = containerW - containerW * newZoom;
  const minOffsetY = containerH - containerH * newZoom;

  newOffsetX = Math.min(0, Math.max(minOffsetX, newOffsetX));
  newOffsetY = Math.min(0, Math.max(minOffsetY, newOffsetY));

  state.panOffset.x = newOffsetX;
  state.panOffset.y = newOffsetY;
  state.zoom = newZoom;
  updateImageTransform();

  if (state.zoom > 1) {
    panZoomBtn.style.opacity = '0';
    panZoomBtn.style.pointerEvents = 'none';
  } else {
    panZoomBtn.style.opacity = '1';
    panZoomBtn.style.pointerEvents = 'auto';
  }
}, { passive: false });

function clampPan() {
  const rect = imageContainer.getBoundingClientRect();
  const containerW = rect.width;
  const containerH = rect.height;

  const minOffsetX = containerW - containerW * state.zoom;
  const minOffsetY = containerH - containerH * state.zoom;

  state.panOffset.x = Math.min(0, Math.max(minOffsetX, state.panOffset.x));
  state.panOffset.y = Math.min(0, Math.max(minOffsetY, state.panOffset.y));
}

function updateImageTransform() {
  const wrapper = document.getElementById('imageTransformWrapper');
  wrapper.style.transform = `translate(${state.panOffset.x}px, ${state.panOffset.y}px) scale(${state.zoom})`;

  // Keep border visually consistent regardless of zoom (softer scaling)
  const scaledBorder = Math.max(1.5, 2 / Math.sqrt(state.zoom));
  document.querySelectorAll('.damage-rect').forEach(rect => {
    rect.style.borderWidth = scaledBorder + 'px';
  });
}

// === Form Preview ===
function showFormPreview() {
  if (state.currentDamage && state.currentDamage.crop) {
    const crop = state.currentDamage.crop;
    const previewContainer = document.querySelector('.form-image-preview');
    const previewImg = document.getElementById('formPreviewImage');

    // Use a canvas to extract the exact crop from the source image
    const sourceImg = new Image();
    sourceImg.src = photoAngles[currentPhotoIndex].src;
    sourceImg.onload = () => {
      const imgW = sourceImg.naturalWidth;
      const imgH = sourceImg.naturalHeight;

      // Pixel coordinates of the crop
      const sx = Math.round(crop.x * imgW);
      const sy = Math.round(crop.y * imgH);
      const sw = Math.round(crop.w * imgW);
      const sh = Math.round(crop.h * imgH);

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(sourceImg, sx, sy, sw, sh, 0, 0, sw, sh);

      // Set as background, contained in the 4:3 box
      previewImg.style.display = 'none';
      previewContainer.style.backgroundImage = `url(${canvas.toDataURL()})`;
      previewContainer.style.backgroundColor = '#1a1a1a';
      previewContainer.style.backgroundSize = 'contain';
      previewContainer.style.backgroundPosition = 'center';
      previewContainer.style.backgroundRepeat = 'no-repeat';
    };

    // If image already cached, onload fires immediately
    if (sourceImg.complete) sourceImg.onload();

    formDamageRect.style.display = 'none';
  }
}

// === Dropdown ===
damageTypeSelect.addEventListener('click', (e) => {
  e.stopPropagation();
  damageTypeDropdown.classList.toggle('open');
});

document.addEventListener('click', () => {
  damageTypeDropdown.classList.remove('open');
});

damageTypeDropdown.addEventListener('click', (e) => {
  if (e.target.classList.contains('dropdown-item')) {
    state.selectedType = e.target.dataset.value;
    damageTypeText.textContent = state.selectedType;
    damageTypeText.classList.add('selected');
    damageTypeDropdown.classList.remove('open');
    checkFormValidity();
  }
});

// === Radio Buttons ===
document.querySelectorAll('input[name="damageSize"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    state.selectedSize = e.target.value;
    checkFormValidity();
  });
});

// === Vehicle Diagram Pin ===
vehicleDiagram.addEventListener('click', (e) => {
  const panel = e.target.closest('.panel-segment');

  // Deselect all panels
  document.querySelectorAll('.panel-segment').forEach(p => p.classList.remove('selected'));

  const rect = vehicleDiagram.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  state.pinLocation = { x, y };
  damagePinMarker.style.display = 'block';
  damagePinMarker.style.left = x + 'px';
  damagePinMarker.style.top = y + 'px';

  // Highlight the selected panel
  if (panel) {
    panel.classList.add('selected');
    state.selectedPanel = panel.dataset.panel;
  }

  checkFormValidity();
});

// === Vehicle Angle Buttons ===
const vehicleSvgMap = {
  driver: 'assets/vehicle-driver.svg',
  front: 'assets/vehicle-front.svg',
  passenger: 'assets/vehicle-passenger.svg',
  back: 'assets/vehicle-rear.svg',
  roof: 'assets/vehicle-roof.svg'
};

document.querySelectorAll('.angle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.angle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Swap the vehicle wireframe SVG
    const angle = btn.dataset.angle;
    const vehicleSvg = document.querySelector('.vehicle-svg');
    if (vehicleSvgMap[angle]) {
      vehicleSvg.style.opacity = '0';
      setTimeout(() => {
        vehicleSvg.src = vehicleSvgMap[angle];
        vehicleSvg.style.opacity = '0.6';
      }, 150);
    }

    // Reset pin and panel selection when changing angle
    damagePinMarker.style.display = 'none';
    state.pinLocation = null;
    state.selectedPanel = null;
    document.querySelectorAll('.panel-segment').forEach(p => p.classList.remove('selected'));
    checkFormValidity();
  });
});

// === Form Validation ===
function checkFormValidity() {
  const isValid = state.selectedType && state.selectedSize && state.pinLocation;
  addDamageBtn.disabled = !isValid;
}

// === Add Damage ===
addDamageBtn.addEventListener('click', () => {
  if (addDamageBtn.disabled) return;

  const panelName = getPanelName();

  // Generate crop data URL for the overview
  const cropDataUrl = generateCropDataUrl();

  if (state.editingDamageId) {
    // Update existing damage
    const damage = savedDamages.find(d => d.id === state.editingDamageId);
    if (damage) {
      damage.type = state.selectedType;
      damage.size = state.selectedSize;
      damage.location = panelName;
      damage.pinLocation = state.pinLocation ? { ...state.pinLocation } : null;
      if (cropDataUrl) damage.cropDataUrl = cropDataUrl;
      if (state.currentDamage) {
        damage.rect = { ...state.currentDamage.rect };
        damage.crop = state.currentDamage.crop ? { ...state.currentDamage.crop } : null;
      }
    }
    state.editingDamageId = null;
  } else {
    // Add new damage
    state.damageCounter++;
    const damage = {
      id: Date.now(),
      type: state.selectedType,
      size: state.selectedSize,
      location: panelName,
      rect: { ...state.currentDamage.rect },
      crop: state.currentDamage.crop ? { ...state.currentDamage.crop } : null,
      pinLocation: state.pinLocation ? { ...state.pinLocation } : null,
      cropDataUrl: cropDataUrl || null,
      photoIndex: currentPhotoIndex,
      photoName: photoAngles[currentPhotoIndex].name
    };
    savedDamages.push(damage);
  }

  // Update state.damages to reflect current photo
  state.damages = savedDamages.filter(d => d.photoIndex === currentPhotoIndex);

  resetMarkDamageForm();
  transitionToDamageModal();
  setTimeout(() => {
    renderDamageList();
    renderDamageRectangles();
  }, 260);
});

function generateCropDataUrl() {
  if (!state.currentDamage || !state.currentDamage.crop) return null;
  const crop = state.currentDamage.crop;
  const img = damageImage;
  if (!img.naturalWidth || !img.complete) return null;

  try {
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const sx = Math.round(crop.x * imgW);
    const sy = Math.round(crop.y * imgH);
    const sw = Math.round(crop.w * imgW);
    const sh = Math.round(crop.h * imgH);

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch(e) {
    return null;
  }
}

function getPanelName() {
  if (state.selectedPanel) return state.selectedPanel;
  const activeAngle = document.querySelector('.angle-btn.active');
  const angle = activeAngle ? activeAngle.dataset.angle : 'driver';
  const names = {
    driver: 'Driver side panel',
    front: 'Front bumper',
    passenger: 'Passenger side panel',
    back: 'Rear bumper',
    roof: 'Roof panel'
  };
  return names[angle] || 'Driver side panel';
}

// === Reset Form ===
function resetMarkDamageForm() {
  state.selectedType = null;
  state.selectedSize = null;
  state.pinLocation = null;
  state.currentDamage = null;
  state.editingDamageId = null;
  state.selectedPanel = null;
  damageTypeText.textContent = 'Select the damage type';
  damageTypeText.classList.remove('selected');
  document.querySelectorAll('input[name="damageSize"]').forEach(r => r.checked = false);
  damagePinMarker.style.display = 'none';
  formDamageRect.style.display = 'none';
  addDamageBtn.disabled = true;
  addDamageBtn.textContent = 'Add and save';
  document.querySelectorAll('.panel-segment').forEach(p => p.classList.remove('selected'));

  // Reset preview image
  const previewContainer = document.querySelector('.form-image-preview');
  const previewImg = document.getElementById('formPreviewImage');
  previewImg.style.display = '';
  previewContainer.style.backgroundImage = '';
  previewContainer.style.backgroundSize = '';
  previewContainer.style.backgroundPosition = '';
}

// === Render Damage List ===
function renderDamageList() {
  const aiForPhoto = state.aiSuggestions.filter(s => s.photoIndex === currentPhotoIndex);
  const hasItems = state.damages.length > 0 || aiForPhoto.length > 0;

  if (!hasItems) {
    damageList.innerHTML = '<div class="damage-empty">None added</div>';
    return;
  }

  let html = '';

  // AI suggestions first
  html += aiForPhoto.map(s => `
    <div class="damage-list-item ai-item" data-ai-id="${s.id}">
      <div style="display:flex;gap:8px;align-items:flex-start;">
        <img class="ai-sparkle" src="assets/icon-glitter.svg" alt="" width="16" height="16">
        <div class="damage-item-info">
          <span class="damage-item-title">${s.type}</span>
          <span class="damage-item-detail">${s.size} - ${s.location}</span>
        </div>
      </div>
      <div class="damage-item-actions">
        <button class="damage-item-btn" onclick="editAiSuggestion('${s.id}')" aria-label="Edit">
          <img src="assets/icon-pencil-edit.svg" alt="" width="16" height="16">
        </button>
        <button class="damage-item-btn" onclick="dismissAiSuggestion('${s.id}')" aria-label="Delete">
          <img src="assets/icon-bin-delete.svg" alt="" width="16" height="16">
        </button>
        <button class="ai-approve-btn" onclick="approveAiSuggestion('${s.id}')" aria-label="Approve">
          <svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4" stroke="#242424" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  // Confirmed damages
  html += state.damages.map((d, i) => `
    <div class="damage-list-item" data-id="${d.id}">
      <div class="damage-item-info">
        <span class="damage-item-title">${d.type}</span>
        <span class="damage-item-detail">${d.size} - ${d.location}</span>
      </div>
      <div class="damage-item-actions">
        <button class="damage-item-btn" onclick="editDamage(${d.id})" aria-label="Edit">
          <img src="assets/icon-pencil-edit.svg" alt="" width="16" height="16">
        </button>
        <button class="damage-item-btn" onclick="deleteDamage(${d.id})" aria-label="Delete">
          <img src="assets/icon-bin-delete.svg" alt="" width="16" height="16">
        </button>
      </div>
    </div>
  `).join('');

  // Show "No agent added damage" if only AI suggestions exist
  if (state.damages.length === 0 && aiForPhoto.length > 0) {
    html += '<div class="damage-empty" style="margin-top:8px;">No agent added damage</div>';
  }

  damageList.innerHTML = html;

  // Damage list rendered
  // Bind hover on list items to show label on corresponding rect
  document.querySelectorAll('.damage-list-item[data-id]').forEach(item => {
    const id = item.dataset.id;
    item.addEventListener('mouseenter', () => {
      const rect = damageRectangles.querySelector(`[data-damage-id="${id}"]`);
      if (rect) { rect.classList.add('highlighted'); rect.classList.add('show-label'); }
    });
    item.addEventListener('mouseleave', () => {
      const rect = damageRectangles.querySelector(`[data-damage-id="${id}"]`);
      if (rect) { rect.classList.remove('highlighted'); rect.classList.remove('show-label'); }
    });
  });

  // Also bind AI suggestion list items
  document.querySelectorAll('.damage-list-item[data-ai-id]').forEach(item => {
    const aiId = item.dataset.aiId;
    item.addEventListener('mouseenter', () => {
      const rect = damageRectangles.querySelector(`[data-ai-id="${aiId}"]`);
      if (rect) rect.classList.add('show-label');
    });
    item.addEventListener('mouseleave', () => {
      const rect = damageRectangles.querySelector(`[data-ai-id="${aiId}"]`);
      if (rect) rect.classList.remove('show-label');
    });
  });
}

// === Render Damage Rectangles on Image ===
const damageTypeLabels = {
  'Scratch or scuff': 'Scratch or scuff',
  'Dent': 'Dent',
  'Paintwork problem': 'Paintwork',
  'Broken or missing trim': 'Broken trim',
  'Windscreen chip or crack': 'Chip or crack',
  'Other': 'Other'
};

function renderDamageRectangles() {
  let html = '';

  // Render confirmed damages
  html += state.damages.map(d => `
    <div class="damage-rect" data-damage-id="${d.id}" onclick="editDamage(${d.id})" style="left:${d.rect.leftPct}%;top:${d.rect.topPct}%;width:${d.rect.widthPct}%;height:${d.rect.heightPct}%;">
      <div class="damage-rect-label">${damageTypeLabels[d.type] || d.type}</div>
    </div>
  `).join('');

  // Render AI suggestions (dotted pink)
  const aiForPhoto = state.aiSuggestions.filter(s => s.photoIndex === currentPhotoIndex);
  html += aiForPhoto.map(s => `
    <div class="damage-rect ai-suggestion" data-ai-id="${s.id}" onclick="editAiSuggestion('${s.id}')" style="left:${s.rect.leftPct}%;top:${s.rect.topPct}%;width:${s.rect.widthPct}%;height:${s.rect.heightPct}%;">
      <div class="damage-rect-label">${damageTypeLabels[s.type] || s.type}</div>
    </div>
  `).join('');

  damageRectangles.innerHTML = html;
}

// === AI Suggestion Actions ===
function approveAiSuggestion(aiId) {
  const suggestion = state.aiSuggestions.find(s => s.id === aiId);
  if (!suggestion) return;

  // Convert to confirmed damage
  const damage = {
    id: Date.now(),
    type: suggestion.type,
    size: suggestion.size,
    location: suggestion.location,
    rect: { ...suggestion.rect },
    crop: suggestion.crop ? { ...suggestion.crop } : null,
    pinLocation: null,
    cropDataUrl: null,
    photoIndex: suggestion.photoIndex,
    photoName: photoAngles[suggestion.photoIndex].name
  };

  savedDamages.push(damage);
  state.damages = savedDamages.filter(d => d.photoIndex === currentPhotoIndex);

  // Remove from suggestions
  state.aiSuggestions = state.aiSuggestions.filter(s => s.id !== aiId);

  renderDamageList();
  renderDamageRectangles();
}

function dismissAiSuggestion(aiId) {
  state.aiSuggestions = state.aiSuggestions.filter(s => s.id !== aiId);
  renderDamageList();
  renderDamageRectangles();
}

function editAiSuggestion(aiId) {
  const suggestion = state.aiSuggestions.find(s => s.id === aiId);
  if (!suggestion) return;

  // Approve it first (add to saved damages), then open for editing
  const damage = {
    id: Date.now(),
    type: suggestion.type,
    size: suggestion.size,
    location: suggestion.location,
    rect: { ...suggestion.rect },
    crop: suggestion.crop ? { ...suggestion.crop } : null,
    pinLocation: null,
    cropDataUrl: null,
    photoIndex: suggestion.photoIndex,
    photoName: photoAngles[suggestion.photoIndex].name
  };

  savedDamages.push(damage);
  state.damages = savedDamages.filter(d => d.photoIndex === currentPhotoIndex);
  state.aiSuggestions = state.aiSuggestions.filter(s => s.id !== aiId);

  // Now open edit for this damage
  editDamage(damage.id);
}

// === Edit / Delete Damage ===
function editDamage(id) {
  const damage = savedDamages.find(d => d.id === id);
  if (!damage) return;

  // Store which damage we're editing
  state.editingDamageId = id;

  // Restore the current damage rect and crop
  state.currentDamage = {
    rect: { ...damage.rect },
    crop: damage.crop ? { ...damage.crop } : null
  };

  // Pre-fill the form
  state.selectedType = damage.type;
  damageTypeText.textContent = damage.type;
  damageTypeText.classList.add('selected');

  state.selectedSize = damage.size;
  document.querySelectorAll('input[name="damageSize"]').forEach(r => {
    r.checked = r.value === damage.size;
  });

  // Show pin if location was saved
  if (damage.pinLocation) {
    state.pinLocation = { ...damage.pinLocation };
    damagePinMarker.style.display = 'block';
    damagePinMarker.style.left = damage.pinLocation.x + 'px';
    damagePinMarker.style.top = damage.pinLocation.y + 'px';
  } else {
    // Set a default pin so form is valid
    state.pinLocation = { x: 380, y: 280 };
    damagePinMarker.style.display = 'block';
    damagePinMarker.style.left = '380px';
    damagePinMarker.style.top = '280px';
  }

  // Show cropped preview
  showFormPreview();

  // Enable the button
  checkFormValidity();

  // Change button text to "Save" for editing
  addDamageBtn.textContent = 'Save';

  // Transition to mark damage screen
  transitionToMarkDamage();
}

function deleteDamage(id) {
  // Remove any existing popover
  if (document.querySelector('.delete-popover')) {
    document.querySelector('.delete-popover').remove();
  }

  const btn = event.currentTarget;
  const btnRect = btn.getBoundingClientRect();

  // Create popover fixed to viewport
  const popover = document.createElement('div');
  popover.className = 'delete-popover';
  popover.style.top = (btnRect.bottom + 8) + 'px';
  popover.style.right = (window.innerWidth - btnRect.right) + 'px';
  popover.innerHTML = `
    <p class="delete-popover-title">Are you sure?</p>
    <div class="delete-popover-actions">
      <button class="delete-popover-cancel" onclick="cancelDelete()">Cancel</button>
      <button class="delete-popover-confirm" onclick="confirmDelete(${id})">Yes, delete</button>
    </div>
  `;
  document.body.appendChild(popover);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', closePopoverOutside);
  }, 10);
}

function closePopoverOutside(e) {
  const popover = document.querySelector('.delete-popover');
  if (popover && !popover.contains(e.target)) {
    popover.remove();
    document.removeEventListener('click', closePopoverOutside);
  }
}

function confirmDelete(id) {
  document.querySelector('.delete-popover')?.remove();
  document.removeEventListener('click', closePopoverOutside);
  savedDamages = savedDamages.filter(d => d.id !== id);
  state.damages = savedDamages.filter(d => d.photoIndex === currentPhotoIndex);
  renderDamageList();
  renderDamageRectangles();
}

function cancelDelete() {
  document.querySelector('.delete-popover')?.remove();
  document.removeEventListener('click', closePopoverOutside);
}

// === Add and Save ===
addAndSaveBtn.addEventListener('click', () => {
  closeDamageModal();
  renderConditionDamageSection();
});

let savedDamages = [];

// Render on page load with all "No"
document.addEventListener('DOMContentLoaded', () => {
  renderConditionDamageSection();
});

function renderConditionDamageSection() {
  const section = document.getElementById('conditionDamageSection');
  const content = document.getElementById('conditionDamageContent');

  section.style.display = 'flex';

  // Group damages by type
  const damageTypes = ['Scratch or scuff', 'Dent', 'Paintwork problem', 'Broken or missing trim', 'Windscreen chip or crack', 'Other'];
  const grouped = {};
  damageTypes.forEach(type => { grouped[type] = []; });
  savedDamages.forEach(d => {
    if (grouped[d.type]) grouped[d.type].push(d);
    else grouped['Other'].push(d);
  });

  const shortLabels = {
    'Scratch or scuff': 'Scratches and scuffs',
    'Dent': 'Dents',
    'Paintwork problem': 'Paintwork problems',
    'Broken or missing trim': 'Broken or missing trim',
    'Windscreen chip or crack': 'Windscreen',
    'Other': 'Other damage'
  };

  const imageLabels = {
    'Scratch or scuff': 'Damage scratches',
    'Dent': 'Damage dents',
    'Paintwork problem': 'Damage paintwork',
    'Broken or missing trim': 'Damage trim',
    'Windscreen chip or crack': 'Damage windscreen',
    'Other': 'Damage other'
  };

  let html = '';

  damageTypes.forEach(type => {
    const items = grouped[type];
    const hasItems = items.length > 0;

    html += `<div class="damage-type-row ${hasItems ? 'has-content' : ''}">
      <div class="damage-type-label">${shortLabels[type]}</div>
      <div class="damage-type-content">
        <div class="damage-yes-no">
          <div class="damage-yes-no-btn ${hasItems ? 'selected' : ''}">Yes</div>
          <div class="damage-yes-no-btn ${!hasItems ? 'selected' : ''}">No</div>
        </div>`;

    if (hasItems) {
      // Size summary
      const sizes = { Small: 0, Medium: 0, Large: 0 };
      items.forEach(d => { if (sizes[d.size] !== undefined) sizes[d.size]++; });
      const sizeParts = [];
      if (sizes.Small > 0) sizeParts.push(`${sizes.Small} small (0-5cm)`);
      if (sizes.Medium > 0) sizeParts.push(`${sizes.Medium} medium (6-15cm)`);
      if (sizes.Large > 0) sizeParts.push(`${sizes.Large} large (16cm+)`);

      html += `<div class="damage-size-summary">${sizeParts.join(', ')}</div>`;
    }

    html += `</div></div>`;

    // Image section for types with damage
    if (hasItems) {
      html += `<div class="damage-images-title">${imageLabels[type]}</div>
        <div class="damage-images-row">`;

      items.forEach((d, idx) => {
        if (idx > 0) html += `<div style="width:16px;flex-shrink:0"></div>`; // 24px - 8px gap already = 16px extra
        html += `<div class="damage-image-group">
          <div class="damage-image-wireframe">
            <img src="assets/vehicle-driver.svg" alt="">
            <div class="wireframe-dot" style="top:45%;left:55%"></div>
          </div>`;
        if (d.cropDataUrl) {
          html += `<div class="damage-image-crop" style="background-image:url(${d.cropDataUrl})"></div>`;
        }
        html += `</div>`;
      });

      html += `</div>`;
    }
  });

  content.innerHTML = html;
}

// === Photo Navigation ===
const photoAngles = [
  { name: 'Driver side - Front', src: 'assets/exterior_front_driver_18753495.jpg' },
  { name: 'Driver side - Back', src: 'assets/exterior_rear_driver_18753495.jpg' },
  { name: 'Passenger side - Front', src: 'assets/exterior_front_passenger_18753495.jpg' },
  { name: 'Passenger side - Back', src: 'assets/exterior_rear_passenger_18753495.jpg' }
];
let currentPhotoIndex = 0;

document.getElementById('prevPhotoBtn').addEventListener('click', () => {
  currentPhotoIndex = (currentPhotoIndex - 1 + photoAngles.length) % photoAngles.length;
  updatePhoto();
});

document.getElementById('nextPhotoBtn').addEventListener('click', () => {
  currentPhotoIndex = (currentPhotoIndex + 1) % photoAngles.length;
  updatePhoto();
});

function updatePhoto() {
  const photo = photoAngles[currentPhotoIndex];
  document.getElementById('modalPhotoTitle').textContent = photo.name;
  damageImage.src = photo.src;
  // Reset zoom/pan
  state.zoom = 1;
  state.panOffset = { x: 0, y: 0 };
  const wrapper = document.getElementById('imageTransformWrapper');
  wrapper.style.transform = '';
  panZoomBtn.style.opacity = '1';
  panZoomBtn.style.pointerEvents = 'auto';
  // Show only damages for this photo
  state.damages = savedDamages.filter(d => d.photoIndex === currentPhotoIndex);
  state.damageCounter = savedDamages.length;
  renderDamageList();
  renderDamageRectangles();
}


// === Scroll Spy for Sidebar ===
document.addEventListener('DOMContentLoaded', () => {
  const photosSection = document.querySelector('.photos-section');
  const conditionSection = document.getElementById('conditionDamageSection');
  const sidebarLinks = document.querySelectorAll('.sidebar-link');

  function updateActiveSidebar() {
    if (!photosSection) return;
    const scrollTop = photosSection.scrollTop;
    const conditionTop = conditionSection ? conditionSection.offsetTop - photosSection.offsetTop : Infinity;

    // Remove all active
    sidebarLinks.forEach(l => l.classList.remove('active'));

    if (scrollTop + 200 >= conditionTop) {
      const condLink = document.querySelector('[data-sidebar="condition"]');
      if (condLink) condLink.classList.add('active');
    } else {
      const photosLink = document.querySelector('[data-sidebar="photos"]');
      if (photosLink) photosLink.classList.add('active');
    }
  }

  if (photosSection) {
    photosSection.addEventListener('scroll', updateActiveSidebar);
    updateActiveSidebar();
  }
});


// === Escape to cancel drawing or close modal ===
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state.isDrawing) {
      state.isDrawing = false;
      drawingRect.style.display = 'none';
    } else if (screens.damageModal.classList.contains('active')) {
      closeDamageModal();
      renderConditionDamageSection();
    }
  }
});
