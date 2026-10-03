import { Stack, useRouter } from 'expo-router';
import { ScrollScreen } from '../../../src/components';
import { MachineForm } from '../../../src/features/MachineForm';
import { createMachine, friendlyError } from '../../../src/lib/api';

export default function NuevaMaquina() {
  const router = useRouter();
  return (
    <ScrollScreen>
      <Stack.Screen options={{ title: 'Nueva máquina' }} />
      <MachineForm initial={{ name: '', description: '', active: true }} showActive={false} submitLabel="Guardar"
        onSubmit={async (v) => {
          try { await createMachine(v.name, v.description.trim() || null); router.back(); return null; }
          catch (e) { return friendlyError(e); }
        }} />
    </ScrollScreen>
  );
}
