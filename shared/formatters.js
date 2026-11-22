/**
 * SGIE — Utilitários de formatação e máscaras (shared/formatters.js)
 * Ordem de carga: config.js -> api.js -> shared/dom.js -> shared/formatters.js -> shared/roles.js -> shared/layout.js
 */

(function (window) {
    'use strict';

    function formatarData(dataIso) {
        if (!dataIso) return '—';
        const str = String(dataIso).trim();
        const partes = str.split('T')[0].split('-');
        if (partes.length === 3) {
            return `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
        return dataIso;
    }

    function formatarHora(horaStr) {
        if (!horaStr) return '—';
        const str = String(horaStr).trim();
        return str.slice(0, 5);
    }

    function formatarDataHora(dataHoraIso) {
        if (!dataHoraIso) return '—';
        try {
            const d = new Date(dataHoraIso);
            if (isNaN(d.getTime())) return String(dataHoraIso);
            return d.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return String(dataHoraIso);
        }
    }

    function formatarMoeda(valor) {
        const num = parseFloat(valor || 0);
        return isNaN(num)
            ? 'R$ 0,00'
            : num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function obterIniciais(nome) {
        if (!nome) return '--';
        const partes = String(nome).trim().split(/\s+/).filter(Boolean);
        if (partes.length === 0) return '--';
        if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
        return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
    }

    function formatarCodigoIngresso(codigo) {
        if (!codigo) return 'Código indisponível';
        return String(codigo).trim();
    }

    function formatarStatusInscricao(status) {
        const mapa = {
            confirmada:          { label: 'Confirmada',              badgeClass: 'badge-success', icon: 'ic-check' },
            pendente_pagamento:  { label: 'Pendente de pagamento',   badgeClass: 'badge-warning', icon: 'ic-clock' },
            lista_espera:        { label: 'Lista de espera',         badgeClass: 'badge-info',    icon: 'ic-info'  },
            cancelada:           { label: 'Cancelada',               badgeClass: 'badge-neutral', icon: 'ic-x'    },
        };
        const s = String(status || '').toLowerCase().trim();
        return mapa[s] || { label: status || 'Indefinido', badgeClass: 'badge-neutral', icon: 'ic-info' };
    }

    function formatarStatusEvento(status) {
        const mapa = {
            rascunho: { label: 'Rascunho', badgeClass: 'badge-neutral' },
            configuracao: { label: 'Configuração', badgeClass: 'badge-info' },
            'configuração': { label: 'Configuração', badgeClass: 'badge-info' },
            publicado: { label: 'Publicado', badgeClass: 'badge-info' },
            'inscricoes abertas': { label: 'Inscrições abertas', badgeClass: 'badge-success' },
            'inscrições abertas': { label: 'Inscrições abertas', badgeClass: 'badge-success' },
            'inscricoes_abertas': { label: 'Inscrições abertas', badgeClass: 'badge-success' },
            'em andamento': { label: 'Em realização', badgeClass: 'badge-warning' },
            'em realizacao': { label: 'Em realização', badgeClass: 'badge-warning' },
            'em realização': { label: 'Em realização', badgeClass: 'badge-warning' },
            'em_realizacao': { label: 'Em realização', badgeClass: 'badge-warning' },
            finalizado: { label: 'Finalizado', badgeClass: 'badge-neutral' },
            arquivado: { label: 'Arquivado', badgeClass: 'badge-neutral' },
            cancelado: { label: 'Cancelado', badgeClass: 'badge-danger' },
        };
        const s = String(status || '').toLowerCase().trim();
        const sSemUnderscore = s.replace(/_/g, ' ');
        return mapa[s] || mapa[sSemUnderscore] || { label: status || 'Indefinido', badgeClass: 'badge-neutral' };
    }

    function formatarStatusPagamento(status) {
        const mapa = {
            pendente: { label: 'Pendente', badgeClass: 'badge-warning' },
            processando: { label: 'Processando', badgeClass: 'badge-info' },
            aprovado: { label: 'Aprovado', badgeClass: 'badge-success' },
            paga: { label: 'Paga', badgeClass: 'badge-success' },
            recusado: { label: 'Recusado', badgeClass: 'badge-danger' },
            cancelado: { label: 'Cancelado', badgeClass: 'badge-danger' },
            expirada: { label: 'Expirada', badgeClass: 'badge-danger' },
            reembolsado: { label: 'Reembolsado', badgeClass: 'badge-neutral' },
        };
        const s = String(status || '').toLowerCase().trim();
        return mapa[s] || { label: status || 'Indefinido', badgeClass: 'badge-neutral' };
    }

    function mascaraTelefone(valor) {
        const v = String(valor || '').replace(/\D/g, '').slice(0, 11);
        if (v.length > 10) {
            return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
        } else if (v.length > 6) {
            return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
        } else if (v.length > 2) {
            return `(${v.slice(0, 2)}) ${v.slice(2)}`;
        }
        return v;
    }

    function mascaraCPF(valor) {
        const v = String(valor || '').replace(/\D/g, '').slice(0, 11);
        if (v.length > 9) {
            return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
        } else if (v.length > 6) {
            return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
        } else if (v.length > 3) {
            return `${v.slice(0, 3)}.${v.slice(3)}`;
        }
        return v;
    }

    function mascaraData(valor) {
        const v = String(valor || '').replace(/\D/g, '').slice(0, 8);
        if (v.length > 4) return `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
        if (v.length > 2) return `${v.slice(0, 2)}/${v.slice(2)}`;
        return v;
    }

    window.SGIE_FORMATTERS = {
        formatarData,
        formatarHora,
        formatarDataHora,
        formatarMoeda,
        obterIniciais,
        formatarCodigoIngresso,
        formatarStatusInscricao,
        formatarStatusEvento,
        formatarStatusPagamento,
        mascaraTelefone,
        mascaraCPF,
        mascaraData,
    };
})(window);
