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
