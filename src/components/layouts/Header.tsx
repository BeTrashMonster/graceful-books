import { Link } from 'react-router-dom'
import './Header.css'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="header">
      <div className="header__container">
        <div className="header__left">
          <button
            className="header__menu-button"
            onClick={onMenuClick}
            aria-label="Toggle navigation menu"
            aria-expanded="false"
          >
            <svg
              className="header__menu-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link to="/dashboard" className="header__logo">
            <span className="header__logo-text">Graceful Books</span>
          </Link>
        </div>

        <div className="header__center">
          {/* Global search - placeholder for now */}
          <div className="header__search">
            <input
              type="search"
              placeholder="Search..."
              className="header__search-input"
              aria-label="Search"
            />
          </div>
        </div>

        <div className="header__right">
          {/* User menu - placeholder for now */}
          <div className="header__user-menu">
            <button className="header__user-button" aria-label="User menu">
              <div className="header__user-avatar">
                <svg
                  className="header__user-icon"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
