import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { generateToken } from "../utils/jwt.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

export async function register(req, res, next) {
  try {
    const { email, username, password } = req.body ?? {};

    if (!email || !username || !password) {
      throw badRequest("Email, username, and password are required");
    }

    const emailNorm = String(email).trim().toLowerCase();
    const usernameNorm = String(username).trim();

    if (!EMAIL_RE.test(emailNorm)) {
      throw badRequest("Invalid email format");
    }

    if (usernameNorm.length < 3) {
      throw badRequest("Username must be at least 3 characters");
    }

    if (password.length < 8) {
      throw badRequest("Password must be at least 8 characters");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        username: usernameNorm,
        password: passwordHash,
      },
      select: { id: true, email: true, username: true, createdAt: true },
    });

    const token = generateToken(user.id);
    res.status(201).json({ token, user });
  } catch (e) {
    if (e.code === "P2002") {
      const err = new Error("Email or username is already taken");
      err.status = 409;
      return next(err);
    }
    next(e);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      throw badRequest("Email and password are required");
    }

    const emailNorm = String(email).trim().toLowerCase();

    if (!EMAIL_RE.test(emailNorm)) {
      throw badRequest("Invalid email format");
    }

    const user = await prisma.user.findUnique({
      where: { email: emailNorm },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      const err = new Error("Invalid email or password");
      err.status = 401;
      throw err;
    }

    const token = generateToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
    });
  } catch (e) {
    next(e);
  }
}
