/**
 * carousel.js — Carrousel automatique de la landing page
 * Platform-Verification
 */

document.addEventListener('DOMContentLoaded', () => {
    const carousel = document.getElementById('hero-carousel');
    const dots = document.querySelectorAll('.carousel-dot');
    if (!carousel || dots.length === 0) return;

    let currentIndex = 0;
    const total = dots.length;

    function showSlide(index) {
        carousel.style.transform = `translateX(-${index * 100}%)`;
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
            dot.classList.toggle('inactive', i !== index);
        });
        currentIndex = index;
    }

    // Auto-play every 3 seconds
    const autoPlay = setInterval(() => {
        showSlide((currentIndex + 1) % total);
    }, 3000);

    // Dot click navigation
    dots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            showSlide(parseInt(e.currentTarget.dataset.index));
        });
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') showSlide((currentIndex + 1) % total);
        if (e.key === 'ArrowLeft')  showSlide((currentIndex - 1 + total) % total);
    });

    // Pause on hover
    carousel.parentElement.addEventListener('mouseenter', () => clearInterval(autoPlay));

    // Init
    showSlide(0);
});
