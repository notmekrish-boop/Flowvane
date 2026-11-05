import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";

function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Set up your workspace and bring your projects together."
      footer={<p className="auth-form-footer">Already have an account? <Link to="/login">Sign in</Link></p>}
    >
      <form onSubmit={handleSubmit} className="auth-form auth-form-register">
        <div className="auth-field">
          <label htmlFor="register-name">Full name</label>
          <input id="register-name" name="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={80} required />
        </div>
        <div className="auth-field">
          <label htmlFor="register-email">Email address</label>
          <input id="register-email" name="email" type="email" autoComplete="email" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </div>
        <div className="auth-field">
          <label htmlFor="register-password">Password</label>
          <input id="register-password" name="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} maxLength={72} required />
        </div>
        <div className="auth-field">
          <label htmlFor="register-confirm-password">Confirm password</label>
          <input id="register-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required />
        </div>
        {error && <p role="alert" className="auth-error">{error}</p>}
        <button type="submit" disabled={loading} className="auth-submit">{loading ? "Creating account…" : "Create account"}<span aria-hidden="true">↗</span></button>
      </form>
    </AuthLayout>
  );
}

export default Register;
