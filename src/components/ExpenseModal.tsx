import React, { useState, useRef } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Expense } from '../types';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
  onRemoveExpense: (id: string) => void;
}

export function ExpenseModal({ isOpen, onClose, expenses, onAddExpense, onRemoveExpense }: ExpenseModalProps) {
  const [type, setType] = useState<Expense['type']>('Combustível');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      alert('Digite um valor válido.');
      return;
    }
    
    onAddExpense({
      id: crypto.randomUUID(),
      type,
      amount: val,
      description,
      date: new Date().toISOString()
    });
    
    setAmount('');
    setDescription('');
  };


  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
      <div 
        className="bg-zinc-950 w-full max-w-lg rounded-t-3xl sm:rounded-3xl border-t sm:border border-zinc-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-black text-white">Registrar Despesa</h2>
            <p className="text-xs text-zinc-500 mt-1">Adicione gastos para abater do lucro da rota</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar">
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 align-middle">
                  Tipo
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue outline-none transition-all"
                >
                  <option value="Combustível">Combustível</option>
                  <option value="Alimentação">Alimentação</option>
                  <option value="Manutenção">Manutenção</option>
                  <option value="Pedágio Extra">Pedágio Extra</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 align-middle">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                Descrição Curta
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Almoço no Graal"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue outline-none transition-all"
              />
            </div>


            <button
              onClick={handleAdd}
              disabled={!amount}
              className="w-full py-3 mt-2 bg-brand-blue hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-500/10 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Adicionar Despesa
            </button>
          </div>

          <div className="pt-5 border-t border-zinc-800/50 space-y-3">
             <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Despesas Desta Rota ({expenses.length})
             </h3>
             {expenses.length === 0 ? (
               <p className="text-xs text-zinc-600 text-center py-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                 Nenhuma despesa registrada.
               </p>
             ) : (
               expenses.map(exp => (
                 <div key={exp.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center gap-3 shadow-md">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-white truncate">{exp.type}</span>
                        <span className="text-[10px] font-medium text-zinc-500">{new Date(exp.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      {exp.description && <p className="text-[10px] text-zinc-400 truncate">{exp.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-red-400">- {formatCurrency(exp.amount)}</p>
                    </div>
                    <button 
                      onClick={() => onRemoveExpense(exp.id)}
                      className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors ml-1 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                 </div>
               ))
             )}
          </div>

        </div>
      </div>
    </div>
  );
}
