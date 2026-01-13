import './Footer.css'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer__container">
        <p className="footer__text">
          &copy; {currentYear} Graceful Books. All rights reserved.
        </p>
        <div className="footer__links">
          <a href="#" className="footer__link">
            Privacy
          </a>
          <span className="footer__separator">|</span>
          <a href="#" className="footer__link">
            Terms
          </a>
          <span className="footer__separator">|</span>
          <a href="#" className="footer__link">
            Help
          </a>
        </div>
      </div>
    </footer>
  )
}
