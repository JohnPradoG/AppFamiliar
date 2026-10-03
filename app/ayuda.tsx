import { Card, Muted, ScrollScreen, SectionTitle } from '../src/components';

const FAQ: [string, string][] = [
  ['¿Qué es esta app?', 'Un registro privado y ordenado del dinero de la familia: cuánto corresponde a cada persona, de dónde viene y cuánto se ha enviado. No es una app bancaria y no mueve dinero real.'],
  ['¿Quién ve mi información?', 'Solo usted y mamá. Cada persona tiene una cuenta privada: nadie más puede ver su saldo, movimientos ni comprobantes.'],
  ['¿Cómo se calcula mi saldo?', 'Es la suma de todo lo que se le ha agregado menos las transferencias que mamá ya le envió. Si mamá corrige o elimina un movimiento, el saldo se recalcula solo.'],
  ['Olvidé mi contraseña', 'En la pantalla de entrada toque "Olvidé mi contraseña", o pídale a mamá un enlace nuevo.'],
  ['¿Qué significa "Corrección"?', 'Es un ajuste que mamá hace a un saldo. Queda marcado para que se entienda por qué cambió.'],
  ['¿Dónde veo los comprobantes?', 'En la pestaña Comprobantes: aparecen cuando mamá adjunta uno a una transferencia.'],
];

export default function Ayuda() {
  return (
    <ScrollScreen>
      {FAQ.map(([q, a]) => (
        <Card key={q}><SectionTitle>{q}</SectionTitle><Muted>{a}</Muted></Card>
      ))}
    </ScrollScreen>
  );
}
