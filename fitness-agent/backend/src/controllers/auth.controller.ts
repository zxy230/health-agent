import { Body, Controller, Post } from "@nestjs/common";
import { AuthDto } from "../dtos/auth.dto";
import { AppStoreService } from "../store/app-store.service";

function buildUserName(email: string, preferredName?: string) {
  if (preferredName && preferredName.trim().length > 0) {
    return preferredName.trim();
  }

  const localPart = email.split("@")[0] ?? "GymPal Member";
  const derived = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return derived || "GymPal Member";
}

@Controller("auth")
export class AuthController {
  constructor(private readonly store: AppStoreService) {}

  @Post("register")
  async register(@Body() body: AuthDto) {
    const user = await this.store.createUser(body.email, body.password, body.name);
    return {
      ok: true,
      userId: user.id,
      name: buildUserName(user.email, user.name),
      email: user.email,
      token: `auth-${user.id}`,
      message: "Registration succeeded."
    };
  }

  @Post("login")
  async login(@Body() body: AuthDto) {
    const user = await this.store.authenticate(body.email, body.password);
    if (!user) {
      return { ok: false, message: "Invalid credentials" };
    }
    return {
      ok: true,
      userId: user.id,
      name: buildUserName(user.email, user.name),
      email: user.email,
      token: `auth-${user.id}`,
      message: "Login succeeded."
    };
  }

  @Post("logout")
  logout() {
    return { ok: true };
  }
}
