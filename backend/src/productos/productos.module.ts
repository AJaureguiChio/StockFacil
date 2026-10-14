import { Module } from '@nestjs/common';
import { ProductosController } from './productos.controller.js';
import { ProductosService } from './productos.service.js';

@Module({ controllers: [ProductosController], providers: [ProductosService] })
export class ProductosModule {}