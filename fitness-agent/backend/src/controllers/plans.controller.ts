import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import {
  AdjustPlanDto,
  CompletePlanSessionDto,
  CreatePlanDayDto,
  GeneratePlanDto,
  UpdatePlanDayDto
} from "../dtos/plans.dto";
import { AppStoreService } from "../store/app-store.service";

@Controller("plans")
export class PlansController {
  constructor(private readonly store: AppStoreService) {}

  @Post("generate")
  async generatePlan(@Body() body: GeneratePlanDto) {
    return this.store.generatePlan(body.userId, body.goal);
  }

  @Get("current")
  async getCurrentPlan(@Headers("x-user-id") userId?: string) {
    return this.store.getCurrentPlanDays(userId);
  }

  @Post("current/day")
  async createCurrentPlanDay(@Body() body: CreatePlanDayDto, @Headers("x-user-id") userId?: string) {
    return this.store.createCurrentPlanDay(body, userId);
  }

  @Patch("current/day/:id")
  async updateCurrentPlanDay(
    @Param("id") dayId: string,
    @Body() body: UpdatePlanDayDto,
    @Headers("x-user-id") userId?: string
  ) {
    return this.store.updateCurrentPlanDay(dayId, body, userId);
  }

  @Delete("current/day/:id")
  async deleteCurrentPlanDay(@Param("id") dayId: string, @Headers("x-user-id") userId?: string) {
    return this.store.deleteCurrentPlanDay(dayId, userId);
  }

  @Post("current/adjust")
  async adjustCurrentPlan(@Body() body: AdjustPlanDto) {
    return this.store.adjustPlan(body.userId, body.note);
  }

  @Post("current/complete-session")
  async completeCurrentPlan(@Body() body: CompletePlanSessionDto) {
    return this.store.completeSession(body.userId, body.dayLabel);
  }
}
