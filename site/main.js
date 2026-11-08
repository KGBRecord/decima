document.documentElement.classList.add('js');
const nav = document.querySelector('.nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// reveal each block once as it enters the viewport (content stays visible without JS or with reduced motion)
const targets = document.querySelectorAll('.hero-copy, .step, .facts-copy, .facts-list, .where figure, .eph-copy, .eph-shots, .popup-in > *, .install-in > *');
targets.forEach((el) => el.classList.add('rv'));
if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
  targets.forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  targets.forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 60}ms`; io.observe(el); });
}
