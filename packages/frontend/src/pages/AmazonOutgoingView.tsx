import { useAmazonPOs } from '../hooks/useShippingModules';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';
import PageContainer from '../components/common/PageContainer';
import type { AmazonPO, AmazonPOItem } from '@aida/shared';
import amazonLogo from '../assets/logos/generic-amazon.svg';

const AmazonOutgoingView = () => {
  const { purchaseOrders, loading, error } = useAmazonPOs();

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="text-red-400 bg-red-900/20 p-4 rounded-md text-center">
        <p>{error}</p>
      </div>
    );
  }

  const outgoingPOs = purchaseOrders.filter(
    po =>
      (po.status === 'Shipped' || po.status === 'Delivered') && po.movedToOutgoing === true
  );

  // Aggregate inbound FBA quantities per SKU across all outgoing POs
  const skuTotals: Record<string, { name: string; quantity: number }> = {};
  for (const po of outgoingPOs) {
    for (const item of po.items) {
      const existing = skuTotals[item.sku];
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        skuTotals[item.sku] = { name: item.name, quantity: item.quantity };
      }
    }
  }

  return (
    <PageContainer
      title="Amazon - Outgoing to FBA"
      titleAdornment={<img src={amazonLogo} alt="Amazon logo" className="w-7 h-7 object-contain" />}
    >
      {outgoingPOs.length === 0 ? (
        <div className="text-center text-slate-400 p-8 border-2 border-dashed border-slate-700 rounded-lg">
          <i className="fas fa-shipping-fast text-3xl mb-3 block" />
          <p className="text-lg font-medium mb-1">No outgoing shipments</p>
          <p className="text-sm">Use "Move to Outgoing" on Shipped POs in the Processing view.</p>
        </div>
      ) : (
        <>
          {/* Inbound FBA SKU summary */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-cyan-300 mb-3">Inbound FBA Quantities</h3>
            <div className="max-h-[calc(100vh-24rem)] overflow-auto">
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="sticky top-0 z-10 bg-slate-700">
                  <tr>
                    <th className="p-card text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="p-card text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="p-card text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Total Inbound Units
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-slate-800 divide-y divide-slate-700">
                  {Object.entries(skuTotals).map(([sku, data], index) => (
                    <tr key={sku} className={`${index % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-700/30'} hover:bg-slate-700`}>
                      <td className="p-card whitespace-nowrap text-sm font-mono text-cyan-300">
                        {sku}
                      </td>
                      <td className="p-card whitespace-nowrap text-sm text-slate-200">
                        {data.name}
                      </td>
                      <td className="p-card whitespace-nowrap text-sm text-right font-bold text-yellow-400">
                        +{data.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Outgoing POs list */}
          <h3 className="text-lg font-semibold text-cyan-300 mb-3">Shipments</h3>
          <div className="space-y-4">
            {outgoingPOs.map((po: AmazonPO) => (
              <div key={po.id} className="bg-slate-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-lg font-bold text-cyan-300">{po.poNumber}</p>
                    <p className="text-sm text-slate-400">
                      Date: {po.poDate} &nbsp;·&nbsp;
                      <StatusBadge
                        text={po.status}
                        tone={po.status === 'Delivered' ? 'success' : 'warning'}
                      />
                    </p>
                  </div>
                </div>
                <div className="max-h-[30vh] overflow-auto">
                  <table className="min-w-full divide-y divide-slate-600">
                  <thead className="sticky top-0 z-10 bg-slate-600/50">
                    <tr>
                      <th className="p-card text-left text-xs font-medium text-slate-400 uppercase">
                        SKU
                      </th>
                      <th className="p-card text-left text-xs font-medium text-slate-400 uppercase">
                        Product
                      </th>
                      <th className="p-card text-right text-xs font-medium text-slate-400 uppercase">
                        Qty
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-600">
                    {po.items.map((item: AmazonPOItem, idx: number) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-700/30'}>
                        <td className="p-card text-sm font-mono text-slate-300">
                          {item.sku}
                        </td>
                        <td className="p-card text-sm text-slate-200">{item.name}</td>
                        <td className="p-card text-sm text-right font-bold text-cyan-300">
                          {item.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </PageContainer>
  );
};

export default AmazonOutgoingView;
