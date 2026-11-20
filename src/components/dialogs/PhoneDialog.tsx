import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { toast } from '@/components/ui/toast-store';
import { messageOf } from '@/data/errors';
import { useAccount, usePhoneVerification } from '@/data/queries';
import { cleanCode, toE164 } from '@/lib/text';
import { useUi } from '@/stores/ui';

/** Confirms the number GameTime calls: a code by text message, through the server (Twilio Verify). */
export function PhoneDialog() {
  const open = useUi((s) => s.dialog.kind === 'phone');
  const close = useUi((s) => s.close);
  const continueFlow = useUi((s) => s.continueFlow);
  const account = useAccount();
  const { send, check } = usePhoneVerification();
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCode('');
    setSentTo(null);
    setError(null);
    send.reset();
    check.reset();
  };

  const submitNumber = () => {
    const e164 = toE164(number);
    if (!e164) return setError('Enter the full number with its country code, like +1 732 555 0134.');
    setError(null);
    send.mutate(e164, { onSuccess: () => setSentTo(e164), onError: (e) => setError(messageOf(e)) });
  };

  const submitCode = () => {
    if (!sentTo) return;
    if (!/^\d{4,10}$/.test(code)) return setError('Enter the code from the text message.');
    setError(null);
    check.mutate(
      { phone: sentTo, code },
      {
        onSuccess: (verified) => {
          if (!verified) return setError("That code isn't right. Check the text message and try again.");
          toast('Number verified. Wake-up calls go to this phone.', { icon: 'check' });
          reset();
          continueFlow();
        },
        onError: (e) => setError(messageOf(e)),
      },
    );
  };

  const current = account.data?.phone;
  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        close();
      }}
      title={sentTo ? 'Enter the code' : 'Your phone number'}
      description={
        sentTo
          ? `We texted a code to ${sentTo}.`
          : current?.verified
            ? `${current.e164} is verified. Enter a new number to change it.`
            : 'Wake-up calls ring this number. First we text you a code to confirm it’s yours.'
      }
      width={480}
    >
      {sentTo ? (
        <form noValidate className="flex flex-col gap-5" onSubmit={(e) => (e.preventDefault(), submitCode())}>
          <Field label="Code" value={code} onChange={(v) => setCode(cleanCode(v).slice(0, 10))} inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="123456" large error={error} />
          <Button type="submit" variant="primary" size="lg" loading={check.isPending}>
            Verify number
          </Button>
          <Button variant="ghost" size="sm" onClick={reset} className="self-start">
            Use a different number
          </Button>
        </form>
      ) : (
        <form noValidate className="flex flex-col gap-5" onSubmit={(e) => (e.preventDefault(), submitNumber())}>
          <Field label="Phone number" value={number} onChange={setNumber} type="tel" autoComplete="tel" autoFocus placeholder="+1 732 555 0134" error={error} />
          <Button type="submit" variant="primary" size="lg" loading={send.isPending}>
            Text me a code
          </Button>
        </form>
      )}
    </Dialog>
  );
}
