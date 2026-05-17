import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import api, { removeAuthToken, setAuthToken } from "../lib/api.js";
import {
  getUser,
  removeToken,
  saveToken,
  saveUser,
} from "../lib/auth.js";

export function useAuth() {
  const [user, setUser] = useState(() => getUser());
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post(
        "/api/auth/login",
        { email, password },
        { headers: { "Content-Type": "application/json" } },
      );
      saveToken(data.token);
      saveUser(data.user);
      setAuthToken(data.token);
      setUser(data.user);
      toast.success("Signed in successfully");
      return data;
    } catch (e) {
      const msg =
        e.response?.data?.error ?? e.message ?? "Login failed";
      toast.error(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async ({ email, username, password }) => {
      setLoading(true);
      try {
        const { data } = await api.post(
          "/api/auth/register",
          {
            email,
            username,
            password,
          },
          { headers: { "Content-Type": "application/json" } },
        );
        saveToken(data.token);
        saveUser(data.user);
        setAuthToken(data.token);
        setUser(data.user);
        toast.success("Account created");
        return data;
      } catch (e) {
        const msg =
          e.response?.data?.error ?? e.message ?? "Registration failed";
        toast.error(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = useCallback((opts = {}) => {
    const silent = Boolean(opts.silent);
    removeToken();
    removeAuthToken();
    setUser(null);
    if (!silent) {
      toast.success("Signed out");
    }
  }, []);

  return {
    user,
    setUser,
    loading,
    login,
    register,
    logout,
  };
}
