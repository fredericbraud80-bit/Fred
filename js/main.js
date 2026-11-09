/* --- CARROUSEL 3D COVERFLOW (style Revolution Slider) --- */
const stage = document.getElementById('carouselStage');
const cards = Array.from(stage.querySelectorAll('.project-card'));
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

let current = 0;              // index de la carte active (boucle infinie)
let dragOffsetX = 0;
let animationPosition = 0;
let animationTarget = 0;
let animationFrame = null;
let isAnimating = false;
let animationStartedAt = 0;
const N = cards.length;       // nombre total de cartes

const COVERFLOW = {
    offsetX: 75,              // % de la largeur de carte entre deux voisines
    rotateY: 13.333,          // deg d'inclinaison par position
    maxVisible: 3             // nombre de cartes visibles de chaque côté
};

/* Distance signée la plus courte, enroulée modulo N → effet de boucle */
function wrappedOffset(i, position = current) {
    let d = (i - position) % N;
    if (d > N / 2) d -= N;
    if (d < -N / 2) d += N;
    return d;
}

function layout() {
    const position = isDragging
        ? dragStartPosition - dragOffsetX / (cards[0].offsetWidth * COVERFLOW.offsetX / 100)
        : isAnimating ? animationPosition : current;

    cards.forEach((card, i) => {
        const offset = wrappedOffset(i, position);
        const abs = Math.abs(offset);
        const edgeFade = Math.max(0, Math.min(1, (N / 2 - abs) / 0.3));
        const opacity = Math.max(0, 1 - abs * 0.22) * edgeFade;

        if (abs > COVERFLOW.maxVisible) {
            card.style.opacity = '0';
            card.style.pointerEvents = 'none';
            card.style.zIndex = '0';
            card.style.transform =
                'translate3d(' + (offset < 0 ? -100 : 100) + 'vw, 0, -600px)';
            return;
        }

        applyPosition(card, offset, abs);
        card.style.opacity = String(opacity);
        card.style.pointerEvents = opacity > 0.05 ? 'auto' : 'none';
    });
}

function applyPosition(card, position, distance) {
    const x = position * COVERFLOW.offsetX;
    const rot = -position * COVERFLOW.rotateY;
    const scale = Math.max(0.2, 1 - distance * 0.2);
    const blur = Math.min(distance * 0.6, 1.2);

    card.style.zIndex = String(50 - Math.round(distance));
    card.style.pointerEvents = 'auto';
    card.style.filter = 'brightness(' + (1 - distance * 0.18) + ') blur(' + blur + 'px)';
    card.style.transform =
        'translate3d(' + x + '%, 0, 0) rotateY(' + rot + 'deg) scale(' + scale + ')';
}

function goTo(index, startPosition = null) {
    const from = isAnimating ? animationPosition : startPosition ?? current;
    const target = isAnimating
        ? animationTarget + (index - current)
        : index;
    if (target === from) return;

    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationPosition = from;
    animationTarget = target;
    animationStartedAt = performance.now();
    isAnimating = true;
    stage.classList.add('is-animating');

    function animate(now) {
        const progress = Math.min((now - animationStartedAt) / 650, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        animationPosition = from + (target - from) * eased;
        layout();

        if (progress < 1) {
            animationFrame = requestAnimationFrame(animate);
            return;
        }

        current = ((target % N) + N) % N;
        animationPosition = current;
        isAnimating = false;
        animationFrame = null;
        stage.classList.remove('is-animating');
        layout();
    }

    animationFrame = requestAnimationFrame(animate);
}

nextBtn.addEventListener('click', () => goTo(current + 1));
prevBtn.addEventListener('click', () => goTo(current - 1));

// Navigation clavier
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') goTo(current + 1);
    if (e.key === 'ArrowLeft') goTo(current - 1);
});

// Clic sur une carte voisine = la ramener au centre (peu importe sa position dans la boucle)
cards.forEach((card, i) => {
    card.addEventListener('click', (e) => {
        if (i !== current) {
            e.stopPropagation();
            goTo(current + wrappedOffset(i));   // chemin le plus court dans la boucle
        }
    });
});

// Glisser-déposer horizontal à la souris ou au doigt
let activePointerId = null;
let startX = 0;
let startY = 0;
let dragStartPosition = 0;
let dragInterruptedAnimation = false;
let isDragging = false;
let suppressClickTimer;

stage.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) ||
        e.target.closest('.nav-arrow')) return;

    activePointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    dragStartPosition = isAnimating ? animationPosition : current;
    dragInterruptedAnimation = false;
    isDragging = false;
});

window.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activePointerId) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!isDragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        dragInterruptedAnimation = isAnimating;
        dragStartPosition = dragInterruptedAnimation ? animationPosition : current;
        if (isAnimating) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
            isAnimating = false;
            stage.classList.remove('is-animating');
        }
        isDragging = true;
        stage.classList.add('is-dragging');
    }
    if (isDragging) {
        dragOffsetX = dx;
        layout();
        e.preventDefault();
    }
});

function finishDrag(e, shouldNavigate) {
    if (e.pointerId !== activePointerId) return;

    const dx = e.clientX - startX;
    const wasDragging = isDragging;
    const stepWidth = cards[0].offsetWidth * COVERFLOW.offsetX / 100;
    const releasedPosition = dragStartPosition - dx / stepWidth;
    let target = Math.round(releasedPosition);
    if (!dragInterruptedAnimation && target === current && Math.abs(dx) > 40) {
        target += dx < 0 ? 1 : -1;
    }
    const shouldChangeCard = shouldNavigate && wasDragging && target !== current;
    if (wasDragging && shouldNavigate) {
        document.addEventListener('click', suppressDraggedClick, true);
        clearTimeout(suppressClickTimer);
        suppressClickTimer = setTimeout(() => {
            document.removeEventListener('click', suppressDraggedClick, true);
        }, 500);
    }

    stage.classList.remove('is-dragging');
    dragOffsetX = 0;
    activePointerId = null;
    isDragging = false;

    if (shouldChangeCard) {
        goTo(target, releasedPosition);
    } else if (wasDragging) {
        layout();
    }
}

function suppressDraggedClick(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    document.removeEventListener('click', suppressDraggedClick, true);
    clearTimeout(suppressClickTimer);
}

window.addEventListener('pointerup', (e) => finishDrag(e, true));
window.addEventListener('pointercancel', (e) => finishDrag(e, false));

layout();

/* --- LECTEUR AUDIO GLOBAL --- */
const TRACKS = {};
document.querySelectorAll('.project-card').forEach(card => {
    TRACKS[card.dataset.trackId] = {
        id: card.dataset.trackId,
        title: card.querySelector('.card-title').textContent,
        src: card.dataset.audio,
        cover: card.dataset.cover,
        card: card
    };
});

const globalAudio = new Audio();
const playerBar = document.getElementById('globalPlayerBar');
const gpCover = document.getElementById('gpCover');
const gpTitle = document.getElementById('gpTitle');
const gpIcon = document.getElementById('gpIcon');
const gpProgress = document.getElementById('gpProgress');
const gpProgressBar = document.getElementById('gpProgressBar');
const gpTime = document.getElementById('gpTime');

const ICON_PLAY = '<polygon points="2,0 14,7 2,14" />';
const ICON_PAUSE = '<rect x="2" y="0" width="3.5" height="14" /><rect x="8.5" y="0" width="3.5" height="14" />';

let currentTrackId = null;

function fmt(s) {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return m + ':' + String(r).padStart(2, '0');
}

function setPlayingCard(id) {
    document.querySelectorAll('.project-card.playing').forEach(c => c.classList.remove('playing'));
    if (id && TRACKS[id]) TRACKS[id].card.classList.add('playing');
}

function setGlobalTrack(track) {
    if (currentTrackId === track.id) {
        // Même piste : on bascule juste lecture/pause (comme Sonaar)
        toggleGlobalPlayback();
        return;
    }
    currentTrackId = track.id;
    globalAudio.src = track.src;
    gpCover.style.backgroundImage = 'url(' + track.cover + ')';
    gpTitle.textContent = track.title;
    playerBar.classList.add('visible');
    document.body.classList.add('player-active');
    setPlayingCard(track.id);
    globalAudio.play();
}

function toggleGlobalPlayback() {
    if (!currentTrackId) return;
    if (globalAudio.paused) {
        globalAudio.play();
    } else {
        globalAudio.pause();
    }
}

function syncPlayIcon() {
    const playing = !globalAudio.paused;
    gpIcon.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    if (TRACKS[currentTrackId]) {
        TRACKS[currentTrackId].card.classList.toggle('playing', playing);
    }
}

globalAudio.addEventListener('play', syncPlayIcon);
globalAudio.addEventListener('pause', syncPlayIcon);

globalAudio.addEventListener('timeupdate', () => {
    if (globalAudio.duration) {
        gpProgressBar.style.width = (globalAudio.currentTime / globalAudio.duration * 100) + '%';
        gpTime.textContent = fmt(globalAudio.currentTime) + ' / ' + fmt(globalAudio.duration);
    }
});

globalAudio.addEventListener('ended', () => {
    setPlayingCard(null);
});

document.getElementById('gpToggle').addEventListener('click', toggleGlobalPlayback);

gpProgress.addEventListener('click', (e) => {
    if (!globalAudio.duration) return;
    const rect = gpProgress.getBoundingClientRect();
    globalAudio.currentTime = (e.clientX - rect.left) / rect.width * globalAudio.duration;
});

document.querySelectorAll('.project-card').forEach((card, i) => {
    const id = card.dataset.trackId;
    card.querySelector('.play-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (i !== current) { goTo(i); return; }
        setGlobalTrack(TRACKS[id]);
    });
});
