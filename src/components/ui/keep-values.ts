"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Submit a form to a useActionState dispatcher WITHOUT React's automatic reset.
 *
 * With `<form action={…}>`, React 19 clears uncontrolled fields after every submission, even when
 * the action returns an error, so a single mistake would wipe the narration someone just edited
 * or the file they chose. Use `<form onSubmit={keepValues(dispatch)}>` on editing forms instead.
 * The clicked button's name/value (e.g. intent) is included, as with a normal submission.
 */
export function keepValues(dispatch: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  };
}
