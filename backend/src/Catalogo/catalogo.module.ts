import { Module } from '@nestjs/common';
import { CatalogoController } from './catalogo.controller.js';

@Module({ controllers: [CatalogoController] })
export class CatalogoModule {}