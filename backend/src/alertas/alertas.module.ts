import { Module } from '@nestjs/common';
import { AlertasController } from './alertas.controller.js';

@Module({ controllers: [AlertasController] })
export class AlertasModule {}