import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DebugController } from './debug.controller.js';
import { NegocioModule } from './negocio/negocio.module.js';
import { CatalogoModule } from './Catalogo/catalogo.module.js';
import { ProductosModule } from './productos/productos.module.js';
import { InventarioModule } from './inventario/inventario.module.js';
import { VentasModule } from './ventas/ventas.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env.local', '../.env', '.env'] }),
    DatabaseModule,
    NegocioModule,
    AuthModule,
    CatalogoModule,
    ProductosModule,
    InventarioModule,
    VentasModule
  ],
  controllers: [DebugController],
})
export class AppModule {}