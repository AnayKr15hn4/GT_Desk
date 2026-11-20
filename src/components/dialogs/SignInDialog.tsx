import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { toast } from '@/components/ui/toast-store';
import { cleanCode, isCompleteCode, isEmail } from '@/lib/text';
import { sendEmailCode, signInErrorMessage, verifyEmailCode } from '@/stores/session';
import { useUi } from '@/stores/ui';

/** Email one-time code sign-in, the same account as the phone app. */
export function SignInDialog() {
  const open = useUi((s) => s.dialog.kind === 'sign-in');
  const close = useUi((s) => s.close);
  const continueFlow = useUi((s) => s.continueFlow);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: (address: string) => sendEmailCode(address),
    onSuccess: (_, address) => setSentTo(address),
  });
  const verify = useMutation({
    mutationFn: ({ address, typed }: { address: string; typed: string }) => verifyEmailCode(address, typed),
    onSuccess: () => {
      toast('Signed in. Your alarms are on every device you use.', { icon: 'check' });
      reset();
      continueFlow();
    },
  });

  const reset = () => {
    setCode('');
    setSentTo(null);
    send.reset();
    verify.reset();
  };

  const submitEmail = () => {
    const address = email.trim();
    if (!isEmail(address)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailError(null);
    send.mutate(address);
  };

  const submitCode = () => {
    if (sentTo && isCompleteCode(code) && !verify.isPending) verify.mutate({ address: sentTo, typed: code });
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        close();
      }}
      title={sentTo ? 'Check your email' : 'Sign in to GameTime'}
      description={
        sentTo ? (
          <>
            Enter the code we sent to <span className="text-ink">{sentTo}</span>. It can take a minute, so check spam too.
          </>
        ) : (
          'Use the email you use on your phone, and your alarms show up here. New here? This creates your account.'
        )
      }
      width={480}
    >
      {sentTo ? (
        <form noValidate
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            submitCode();
          }}
        >
          <Field
            label="Code"
            value={code}
            onChange={(v) => setCode(cleanCode(v).slice(0, 10))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="123456"
            large
            error={verify.isError ? signInErrorMessage(verify.error, 'verify') : send.isError ? signInErrorMessage(send.error, 'send') : null}
          />
          <Button type="submit" variant="primary" size="lg" loading={verify.isPending} disabled={!isCompleteCode(code)}>
            Sign in
          </Button>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                verify.reset();
                setCode('');
                send.mutate(sentTo, { onSuccess: () => toast('We sent a new code.', { icon: 'check' }) });
              }}
              loading={send.isPending}
            >
              Send a new code
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              Use a different email
            </Button>
          </div>
        </form>
      ) : (
        <form noValidate
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            submitEmail();
          }}
        >
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            error={emailError ?? (send.isError ? signInErrorMessage(send.error, 'send') : null)}
          />
          <Button type="submit" variant="primary" size="lg" loading={send.isPending}>
            Email me a code
          </Button>
        </form>
      )}
    </Dialog>
  );
}
