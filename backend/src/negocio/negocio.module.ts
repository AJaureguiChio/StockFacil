import { Module } from '@nestjs/common';
import { NegocioController } from './negocio.controller.js';
import { NegocioService } from './negocio.service.js';

@Module({
    controllers: [NegocioController],
    providers: [NegocioService]
})
export class NegocioModule { }