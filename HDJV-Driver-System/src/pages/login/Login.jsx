import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import { login } from '../../utils/api/index.js'
import { useLanguage } from '../../contexts/useLanguage'
import './Login.css'
import LogoWebp from '../../assets/images/HDJV_TRANSPO_LOGO_1.webp'

const Login = () => {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(email, password, rememberMe)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || t('login.loginFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-page" role="main">
      <div className="login-card">
        <section className="login-hero">
          <img
            src={LogoWebp}
            alt="HDJV Logo"
            width="1536"
            height="1024"
            fetchPriority="high"
            decoding="async"
          />
        </section>

        <section className="login-panel">
          <h2>{t('login.signIn')}</h2>
          <p className="panel-subtitle">{t('login.subtitle')}</p>
          {error && <div className="login-error"><i className="bi bi-exclamation-circle"></i>{error}</div>}
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="login-email">{t('login.email')}</label>
              <input
                id="login-email"
                type="email"
                placeholder={t('login.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="login-password">{t('login.password')}</label>
              <div className="password-input-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('login.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  className="password-input"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(p => !p)}
                  title={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
            </div>
            <label className="remember-option">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLoading}
              />
              <span>{t('login.remember')}</span>
            </label>
            <button type="submit" className="login-submit" disabled={isLoading}>
              {isLoading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>
          <p className="panel-footer">{t('login.needAccess')}</p>
        </section>
      </div>
    </main>
  )
}

export default Login


