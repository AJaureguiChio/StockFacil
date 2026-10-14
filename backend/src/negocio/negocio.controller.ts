import { Body, Controller, Get, Post } from '@nestjs/common';
import { AllowNoProfile, Auth, Tenant } from '../auth/auth.decorators.js';
import type { AuthInfo, TenantCtx } from '../auth/auth.types.js';
import { OnboardingDto } from './negocio.dto.js';
import { NegocioService } from './negocio.service.js';

@Controller()
export class NegocioController {
    constructor(private readonly service: NegocioService) { }

    /** Quién soy y a qué negocio pertenezco (perfil = null → falta el onboarding). */
    @Get('me') @AllowNoProfile()
    me(@Auth() auth: AuthInfo, @Tenant() tenant?: TenantCtx) {
        return this.service.me(auth, tenant);
    }

    @Post('onboarding') @AllowNoProfile()
    onboarding(@Auth() auth: AuthInfo, @Body() dto: OnboardingDto) {
        return this.service.onboard(auth, dto);
    }
}