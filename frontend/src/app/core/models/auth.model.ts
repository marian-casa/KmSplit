export interface LoginRequest {
  email: string;
  password: string;
  /** "Recordarme": mantiene la sesión ~7 días deslizantes (cookie persistente). */
  remember?: boolean;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetVerifyRequest {
  email: string;
  code: string;
}

export interface PasswordResetConfirmRequest {
  email: string;
  code: string;
  new_password: string;
  confirm_password: string;
}

export interface AccessTokenResponse {
  access: string;
}
