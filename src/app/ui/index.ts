/**
 * Shared UI kit barrel.
 *
 * Import from `@/app/ui` style paths (`../ui`) rather than deep paths, so a
 * component can be reorganised without touching every consumer.
 *
 * Toast content is driven by the imperative `showToast` API in
 * `src/modules/ui/Toast.ts` (40 call sites go through the `showToast` feature
 * port); the kit's `<Toaster>` subscribes to that stream and renders it over
 * Radix, so call-site behaviour is unchanged. Mount it once at the app root.
 */
export { Button } from './Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button';
export { Input, FieldLabel } from './Input';
export type { InputProps } from './Input';
export { Card, CardHeader, CardTitle, CardBody, CardFooter } from './Card';
export type { CardProps } from './Card';
export {
  Table,
  TableCaption,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  TableNumericCell,
} from './Table';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
export type { TabsProps } from './Tabs';
export { Select, SelectItem, SelectGroup, SelectLabel } from './Select';
export type { SelectProps } from './Select';
export { Dialog, DialogTrigger, DialogClose } from './Dialog';
export type { DialogProps } from './Dialog';
export { Toaster } from './Toast';
export { cn } from './cn';
