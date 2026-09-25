import { describe, expect, it } from 'vitest';
import { STRINGS, errorText } from './i18n';
import { toError } from './store';

describe('Fehlermeldungen aus Supabase', () => {
  it('zeigt die Meldung statt [object Object]', () => {
    const err = toError({ message: 'new row violates row-level security policy', code: '42501' });
    expect(errorText(err, STRINGS.de)).toBe('new row violates row-level security policy');
  });

  it('erklärt eine fehlende Spalte', () => {
    const err = toError({
      message: "Could not find the 'birth_name' column of 'persons' in the schema cache",
      code: 'PGRST204',
    });
    expect(errorText(err, STRINGS.de)).toBe(STRINGS.de.errSchemaOutdated);
  });

  it('kommt auch mit einfachen Objekten zurecht', () => {
    expect(errorText({ message: 'kaputt' }, STRINGS.tr)).toBe('kaputt');
  });
});
