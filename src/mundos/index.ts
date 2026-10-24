import type { WorldModule } from '../engine/cadena';
import { planck } from './planck';
import { unificacion } from './unificacion';
import { desierto } from './desierto';
import { colisionador } from './colisionador';
import { proton } from './proton';
import { nucleo } from './nucleo';
import { vacio } from './vacio';
import { atomo } from './atomo';
import { adn } from './adn';
import { nucleosomas } from './nucleosomas';
import { cromatina } from './cromatina';
import { celula } from './celula';
import { tejido } from './tejido';
import { hoja } from './hoja';
import { arbol } from './arbol';
import { valle } from './valle';
import { tierra } from './tierra';
import { luna } from './luna';
import { solar } from './solar';
import { voyager } from './voyager';
import { oort } from './oort';
import { vecindario } from './vecindario';
import { radcliffe } from './radcliffe';
import { galaxia } from './galaxia';
import { grupoLocal } from './grupo-local';
import { redCosmica } from './red-cosmica';
import { universo } from './universo';
import { masAlla, multiverso } from './hipotesis';
import { paisaje } from './paisaje';
import { matematico } from './matematico';

/**
 * The journey, smallest first. Each world sits inside the next. Shared by the page and the
 * worker that generates the worlds, so both know them by the same ids.
 */
export function crearMundos(): WorldModule[] {
  return [
    planck(),
    unificacion(),
    desierto(),
    colisionador(),
    proton(),
    nucleo(),
    vacio(),
    atomo(),
    adn(),
    nucleosomas(),
    cromatina(),
    celula(),
    tejido(),
    hoja(),
    arbol(),
    valle(),
    tierra(),
    luna(),
    solar(),
    voyager(),
    oort(),
    vecindario(),
    radcliffe(),
    galaxia(),
    grupoLocal(),
    redCosmica(),
    universo(),
    masAlla(),
    multiverso(),
    paisaje(),
    matematico(),
  ];
}
