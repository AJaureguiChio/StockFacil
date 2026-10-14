import { Controller, Get } from '@nestjs/common';
import { AllowNoProfile, Auth, Public } from './auth/auth.decorators.js';
import type { AuthInfo } from './auth/auth.types.js';
import { DatabaseService } from './database/database.service.js';

@Controller()
export class DebugController {
  constructor(private readonly db: DatabaseService) {}

  /** Público: comprueba la conexión con Neon. */
  @Public() @Get('health')
  async health() {
    const r = await this.db.queryOne<{ ahora: Date }>('SELECT now() AS ahora');
    return { ok: true, db_time: r?.ahora };
  }

  /** Protegido: devuelve la identidad que viene en el token. */
  @AllowNoProfile() @Get('whoami')
  whoami(@Auth() auth: AuthInfo) {
    return auth;
  }

  @Get('Conexion')
  conexion(){
    return "Texto"
  }
}