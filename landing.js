// Landing Page Logic

// Scroll Effect for Navbar
window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (window.scrollY > 50) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});

// Smooth scroll internal links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth',
        });
    });
});

// Mobile Menu Toggle
const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('main-nav');

if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', e => {
        e.stopPropagation();
        menuToggle.classList.toggle('active');
        mainNav.classList.toggle('active');
        document.body.style.overflow = mainNav.classList.contains('active') ? 'hidden' : 'auto';
    });

    // Close menu when clicking outside
    document.addEventListener('click', e => {
        if (!mainNav.contains(e.target) && !menuToggle.contains(e.target)) {
            menuToggle.classList.remove('active');
            mainNav.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    });

    // Close menu when clicking a link
    mainNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            menuToggle.classList.remove('active');
            mainNav.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    });
}

// --- Látogatottság követése (Page View Tracking) ---
function trackPageView(pageName) {
    let visitorId = localStorage.getItem('dragonwave_visitor_id');
    if (!visitorId) {
        visitorId =
            'visitor_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('dragonwave_visitor_id', visitorId);
    }
    const hasRegistered = localStorage.getItem('dragonwave_has_registered') === 'true';
    const API_BASE =
        window.location.hostname === 'localhost' || window.location.protocol === 'file:'
            ? 'http://localhost:3001/api'
            : '/api';

    fetch(API_BASE + '/analytics/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            page: pageName,
            visitorId: visitorId,
            hasRegistered: hasRegistered,
        }),
    }).catch(() => {});
}

// Oldal betöltésekor automatikus mérés indítása
document.addEventListener('DOMContentLoaded', () => {
    let pageName = 'Főoldal';
    const path = window.location.pathname;
    if (path.includes('registered_list.html')) {
        pageName = 'Rajtlista';
    } else if (path.includes('versenykiiras.html')) {
        pageName = 'Versenykiírás';
    }
    trackPageView(pageName);
});
