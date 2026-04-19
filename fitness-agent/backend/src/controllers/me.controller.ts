import { Body, Controller, Get, Headers, Patch } from "@nestjs/common";
import { UpdateProfileDto } from "../dtos/profile.dto";
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

@Controller()
export class MeController {
  constructor(private readonly store: AppStoreService) {}

  @Get("me")
  async me(@Headers("x-user-id") userId?: string) {
    const user = await this.store.getUser(userId);
    return {
      id: user.id,
      name: buildUserName(user.email, user.name),
      email: user.email,
      profile: user.healthProfile
    };
  }

  @Patch("me/profile")
  async updateProfile(@Body() body: UpdateProfileDto, @Headers("x-user-id") userId?: string) {
    const user = await this.store.getUser(userId);
    return this.store.updateProfile(user.id, body);
  }
}
