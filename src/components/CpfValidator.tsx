"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  CreditCard, AlertCircle, Search, Loader2, ChevronLeft,
  CheckCircle2, ShieldCheck, UserCheck, UserX, Fingerprint
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CpfValidatorProps {
  cpfBusca: string;
  setCpfBusca: (value: string) => void;
  cpfError: string;
  setCpfError: (value: string) => void;
  buscandoCpf: boolean;
  onBuscarCPF: () => void;
  onVoltar: () => void;
}

// CPF formatting
const formatCPF = (value: string) => {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  return numbers
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

// Full CPF validation (mod 11)
const validarCPFCompleto = (cpf: string): boolean => {
  const cpfLimpo = cpf.replace(/\D/g, '');
  if (cpfLimpo.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpfLimpo)) return false;
  let soma = 0;
  for (let i = 1; i <= 9; i++) soma += parseInt(cpfLimpo.substring(i - 1, i)) * (11 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpfLimpo.substring(9, 10))) return false;
  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(cpfLimpo.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpfLimpo.substring(10, 11))) return false;
  return true;
};

type ValidationState = 'idle' | 'typing' | 'valid' | 'invalid' | 'searching' | 'error';

export function CpfValidator({
  cpfBusca,
  setCpfBusca,
  cpfError,
  setCpfError,
  buscandoCpf,
  onBuscarCPF,
  onVoltar,
}: CpfValidatorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const cpfDigits = cpfBusca.replace(/\D/g, '');
  const digitCount = cpfDigits.length;

  // Determine validation state
  const getValidationState = useCallback((): ValidationState => {
    if (buscandoCpf) return 'searching';
    if (cpfError) return 'error';
    if (digitCount === 0) return 'idle';
    if (digitCount < 11) return 'typing';
    if (digitCount === 11) {
      return validarCPFCompleto(cpfBusca) ? 'valid' : 'invalid';
    }
    return 'idle';
  }, [buscandoCpf, cpfError, digitCount, cpfBusca]);

  const validationState = getValidationState();

  // Show validation feedback after a brief delay when complete
  useEffect(() => {
    if (digitCount === 11) {
      const t = setTimeout(() => setShowValidation(true), 150);
      return () => clearTimeout(t);
    } else {
      setShowValidation(false);
    }
  }, [digitCount]);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpfBusca(formatCPF(e.target.value));
    setCpfError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && validationState === 'valid') {
      e.preventDefault();
      onBuscarCPF();
    }
  };

  // Visual config per state
  const stateConfig = {
    idle: {
      ringColor: 'ring-transparent',
      borderColor: 'border-border',
      bgColor: 'bg-background-secondary',
      iconColor: 'text-text-muted',
    },
    typing: {
      ringColor: 'ring-black/5',
      borderColor: 'border-text-muted',
      bgColor: 'bg-background-secondary',
      iconColor: 'text-text-secondary',
    },
    valid: {
      ringColor: 'ring-success/20',
      borderColor: 'border-success',
      bgColor: 'bg-success-light/30',
      iconColor: 'text-success',
    },
    invalid: {
      ringColor: 'ring-error/20',
      borderColor: 'border-error',
      bgColor: 'bg-error-light/30',
      iconColor: 'text-error',
    },
    searching: {
      ringColor: 'ring-black/10',
      borderColor: 'border-black',
      bgColor: 'bg-background-secondary',
      iconColor: 'text-text-secondary',
    },
    error: {
      ringColor: 'ring-error/20',
      borderColor: 'border-error',
      bgColor: 'bg-error-light/30',
      iconColor: 'text-error',
    },
  };

  const config = stateConfig[validationState];

  // Progress percentage
  const progress = Math.min((digitCount / 11) * 100, 100);

  // Digit groups for display: XXX.XXX.XXX-XX
  const digitSlots = Array.from({ length: 11 }, (_, i) => cpfDigits[i] || '');

  return (
    <div className="animate-fade-in">
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <motion.div
              className={`p-2.5 rounded-xl transition-colors duration-300 ${
                validationState === 'valid' ? 'bg-success-light' :
                validationState === 'invalid' || validationState === 'error' ? 'bg-error-light' :
                validationState === 'searching' ? 'bg-gray-100' :
                'bg-background-secondary'
              }`}
              animate={validationState === 'searching' ? { rotate: [0, 5, -5, 0] } : {}}
              transition={{ duration: 0.5, repeat: validationState === 'searching' ? Infinity : 0 }}
            >
              {validationState === 'valid' ? (
                <ShieldCheck className="h-5 w-5 text-success" />
              ) : validationState === 'invalid' || validationState === 'error' ? (
                <AlertCircle className="h-5 w-5 text-error" />
              ) : validationState === 'searching' ? (
                <Loader2 className="h-5 w-5 text-text-secondary animate-spin" />
              ) : (
                <Fingerprint className="h-5 w-5 text-text-secondary" />
              )}
            </motion.div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-text-primary">Identificação por CPF</h2>
              <p className="text-xs text-text-muted mt-0.5">
                {validationState === 'idle' && 'Digite seu CPF para verificarmos seu cadastro'}
                {validationState === 'typing' && `${digitCount} de 11 dígitos`}
                {validationState === 'valid' && 'CPF válido — pronto para buscar'}
                {validationState === 'invalid' && 'CPF inválido — verifique os dígitos'}
                {validationState === 'searching' && 'Verificando cadastro...'}
                {validationState === 'error' && 'Ocorreu um erro na verificação'}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1 bg-background-secondary rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                validationState === 'valid' ? 'bg-success' :
                validationState === 'invalid' || validationState === 'error' ? 'bg-error' :
                validationState === 'searching' ? 'bg-black' :
                'bg-text-muted'
              }`}
              initial={{ width: 0 }}
              animate={{
                width: validationState === 'searching' ? '100%' : `${progress}%`,
              }}
              transition={{
                duration: 0.3,
                ease: 'easeOut',
                ...(validationState === 'searching' ? { duration: 1.5, repeat: Infinity, repeatType: 'reverse' as const } : {}),
              }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Digit display slots */}
          <div className="flex justify-center">
            <div
              className="flex items-center gap-0.5 sm:gap-1 cursor-text"
              onClick={() => inputRef.current?.focus()}
            >
              {/* Group 1: XXX */}
              {[0, 1, 2].map((i) => (
                <DigitSlot
                  key={i}
                  digit={digitSlots[i]}
                  isActive={isFocused && digitCount === i}
                  isFilled={!!digitSlots[i]}
                  state={validationState}
                />
              ))}
              <Separator />
              {/* Group 2: XXX */}
              {[3, 4, 5].map((i) => (
                <DigitSlot
                  key={i}
                  digit={digitSlots[i]}
                  isActive={isFocused && digitCount === i}
                  isFilled={!!digitSlots[i]}
                  state={validationState}
                />
              ))}
              <Separator />
              {/* Group 3: XXX */}
              {[6, 7, 8].map((i) => (
                <DigitSlot
                  key={i}
                  digit={digitSlots[i]}
                  isActive={isFocused && digitCount === i}
                  isFilled={!!digitSlots[i]}
                  state={validationState}
                />
              ))}
              <DashSeparator />
              {/* Group 4: XX */}
              {[9, 10].map((i) => (
                <DigitSlot
                  key={i}
                  digit={digitSlots[i]}
                  isActive={isFocused && digitCount === i}
                  isFilled={!!digitSlots[i]}
                  state={validationState}
                  isVerifier
                />
              ))}
            </div>
          </div>

          {/* Hidden real input */}
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={cpfBusca}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            maxLength={14}
            className="sr-only"
            autoFocus
            aria-label="CPF"
          />

          {/* Fallback visible input for accessibility */}
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <CreditCard className={`h-4 w-4 transition-colors duration-200 ${config.iconColor}`} />
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={cpfBusca}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => { setIsFocused(true); }}
              onBlur={() => setIsFocused(false)}
              placeholder="000.000.000-00"
              maxLength={14}
              className={`w-full pl-10 pr-12 h-14 text-lg font-mono font-medium text-center rounded-xl border-2 ring-2 transition-all duration-200 outline-none ${config.bgColor} ${config.borderColor} ${config.ringColor}`}
            />
            {/* Right side status icon */}
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <AnimatePresence mode="wait">
                {validationState === 'valid' && showValidation && (
                  <motion.div
                    key="valid"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  >
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </motion.div>
                )}
                {(validationState === 'invalid' || validationState === 'error') && showValidation && (
                  <motion.div
                    key="invalid"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  >
                    <AlertCircle className="h-5 w-5 text-error" />
                  </motion.div>
                )}
                {validationState === 'searching' && (
                  <motion.div
                    key="searching"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Loader2 className="h-5 w-5 text-text-muted animate-spin" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Validation feedback messages */}
          <AnimatePresence mode="wait">
            {validationState === 'valid' && showValidation && !cpfError && (
              <motion.div
                key="msg-valid"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-2.5 px-4 py-3 bg-success-light/50 border border-success/20 rounded-lg">
                  <UserCheck className="h-4 w-4 flex-shrink-0 text-success-dark" />
                  <p className="text-sm text-success-dark font-medium">CPF válido. Clique em "Verificar cadastro" para continuar.</p>
                </div>
              </motion.div>
            )}
            {validationState === 'invalid' && showValidation && (
              <motion.div
                key="msg-invalid"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-2.5 px-4 py-3 bg-error-light/50 border border-error/20 rounded-lg">
                  <UserX className="h-4 w-4 flex-shrink-0 text-error-dark" />
                  <div>
                    <p className="text-sm text-error-dark font-medium">CPF inválido</p>
                    <p className="text-xs text-error-dark/70 mt-0.5">Verifique os dígitos e tente novamente.</p>
                  </div>
                </div>
              </motion.div>
            )}
            {cpfError && (
              <motion.div
                key="msg-error"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-2.5 px-4 py-3 bg-error-light/50 border border-error/20 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-error-dark" />
                  <p className="text-sm text-error-dark font-medium">{cpfError}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Searching overlay card */}
          <AnimatePresence>
            {buscandoCpf && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="flex items-center gap-3 p-4 bg-gray-50 border border-border rounded-lg"
              >
                <div className="relative">
                  <div className="h-10 w-10 rounded-full border-2 border-border bg-white flex items-center justify-center">
                    <Search className="h-4 w-4 text-text-muted" />
                  </div>
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-t-black border-r-transparent border-b-transparent border-l-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Verificando cadastro...</p>
                  <p className="text-xs text-text-muted mt-0.5">Buscando CPF {cpfBusca} na base de dados</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              onClick={onVoltar}
              variant="outline"
              className="h-12 px-4 rounded-xl border border-border hover:bg-background-secondary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              onClick={onBuscarCPF}
              disabled={validationState !== 'valid' || buscandoCpf}
              className={`flex-1 h-12 rounded-xl font-medium transition-all duration-200 ${
                validationState === 'valid'
                  ? 'bg-black hover:bg-primary-hover text-white shadow-md hover:shadow-lg'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {buscandoCpf ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Verificando...</>
              ) : validationState === 'valid' ? (
                <><UserCheck className="h-4 w-4 mr-2" /> Verificar cadastro</>
              ) : (
                <><Search className="h-4 w-4 mr-2" /> Verificar cadastro</>
              )}
            </Button>
          </div>

          {/* Helper text */}
          <p className="text-center text-[11px] text-text-muted">
            Seus dados são protegidos conforme a LGPD
          </p>
        </div>
      </div>
    </div>
  );
}

// === Sub-components ===

function DigitSlot({
  digit,
  isActive,
  isFilled,
  state,
  isVerifier = false,
}: {
  digit: string;
  isActive: boolean;
  isFilled: boolean;
  state: ValidationState;
  isVerifier?: boolean;
}) {
  const stateColors = {
    idle: 'border-border bg-background-secondary',
    typing: isFilled ? 'border-text-muted bg-white' : 'border-border bg-background-secondary',
    valid: 'border-success/40 bg-success-light/30',
    invalid: 'border-error/40 bg-error-light/30',
    searching: 'border-text-muted bg-background-secondary',
    error: 'border-error/40 bg-error-light/30',
  };

  const textColor = {
    idle: 'text-text-muted',
    typing: isFilled ? 'text-text-primary' : 'text-text-muted',
    valid: 'text-success-dark',
    invalid: 'text-error-dark',
    searching: 'text-text-secondary',
    error: 'text-error-dark',
  };

  return (
    <motion.div
      className={`relative w-7 h-10 sm:w-8 sm:h-11 flex items-center justify-center rounded-lg border transition-colors duration-200 ${stateColors[state]} ${
        isActive ? 'ring-2 ring-black/20 border-black' : ''
      } ${isVerifier ? 'ring-offset-1' : ''}`}
      animate={
        isFilled && state === 'valid'
          ? { scale: [1, 1.05, 1] }
          : {}
      }
      transition={{ duration: 0.2 }}
    >
      <span className={`text-base sm:text-lg font-mono font-semibold transition-colors ${textColor[state]}`}>
        {digit || (
          <span className="text-text-muted/30 text-sm">–</span>
        )}
      </span>
      {isActive && (
        <motion.div
          className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-black rounded-full"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}

function Separator() {
  return (
    <span className="text-text-muted/40 text-lg font-light mx-0.5 select-none">.</span>
  );
}

function DashSeparator() {
  return (
    <span className="text-text-muted/40 text-lg font-light mx-0.5 select-none">-</span>
  );
}
