/** Keys untuk app_settings (pengaturan dinamisasi). Bukan 'use server' agar bisa di-import dari client. */
export const APP_SETTINGS_KEYS = {
  /** Judul aplikasi (tab browser & metadata) */
  APP_TITLE: 'app_title',
  /** URL favicon (bisa di-upload ke Blob) */
  APP_FAVICON_URL: 'app_favicon_url',
  LOGO_URL: 'app_logo_url',
  SIDEBAR_BG_COLOR: 'app_sidebar_bg_color',
  COMPANY_NAME: 'app_company_name',
  /** Satu blok HTML untuk seluruh teks kanan halaman login (judul, subtitle, poin-poin). Gunakan <ul>/<li> atau <br>. */
  LOGIN_CONTENT: 'app_login_content',
  LOGIN_TONE_BG: 'app_login_tone_bg',
  LOGIN_BG_IMAGE: 'app_login_bg_image',
} as const
