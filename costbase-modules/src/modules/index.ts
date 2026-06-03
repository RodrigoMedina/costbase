import { ModuloDefinicion } from '../types/module.types';

import { Z1 } from './cimentacion/Z1-zapata-corrida-2-escarpios';
import { P1 } from './cimentacion/P1-pilote-1';
import { C1 } from './estructura/C1-columna-rectangular';
import { L1 } from './estructura/L1-losa-1-armado';
import { K1 } from './albanileria/K1-castillo-rectangular';
import { M1 } from './albanileria/M1-muro-tabique-14';
import { F01 } from './aluminio/F01-ventana-1-fijo';
import { E1 } from './herreria/E1-escalera-marina';
import { SEL08 } from './salidas-electricas/SEL08-alimentacion-1-cedula-cajas';
import { SHS17 } from './hidrosanitarias/SHS17-linea-toma-cisterna';

export const ALL_MODULES: Record<string, ModuloDefinicion> = {
  Z1,
  P1,
  C1,
  L1,
  K1,
  M1,
  F01,
  E1,
  SEL08,
  SHS17,
};

export const MODULE_CODES = Object.keys(ALL_MODULES);
