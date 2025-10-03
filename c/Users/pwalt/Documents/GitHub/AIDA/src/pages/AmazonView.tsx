
// ... existing code
      <h2 className="text-2xl font-semibold text-cyan-400 mb-6">FBA Stock Levels</h2>
      <div className="grid grid-cols-2 gap-6">
        {amazonInventory.map((item: AmazonItem) => (
          <div key={item.id} className="bg-slate-700 p-4 rounded-lg flex flex-col justify-between relative">
            <div>
              <span className="absolute top-2 right-2 text-xs text-slate-400">Data Updated: {item.updatedAt?.toDate().toLocaleDateString()}</span>
              <div>
                <h3 className="text-xl font-bold text-cyan-300">{item.name}</h3>
                <p className="text-sm text-slate-400 mb-4">{item.sku}</p>
                <div>
                  <div className="mb-4">
                    <p className="font-semibold">FBA Base</p>
                    <p>Current Stock: {item.amazonFBA_BaseQuantity || 0}</p>
                    <p>Inbound: {item.amazonFBA_Base_OnTheWayQuantity || 0}</p>
                    <StockLevelBar level={item.amazonFBA_BaseQuantity || 0} inboundLevel={item.amazonFBA_Base_OnTheWayQuantity || 0} maxLevel={50} />
                  </div>
                  <div className="mb-4">
                    <p className="font-semibold">FBA 250 Pack</p>
                    <p>Current Stock: {item.amazonFBA_250Quantity || 0}</p>
                    <p>Inbound: {item.amazonFBA_250_OnTheWayQuantity || 0}</p>
                    <StockLevelBar level={item.amazonFBA_250Quantity || 0} inboundLevel={item.amazonFBA_250_OnTheWayQuantity || 0} maxLevel={50} />
                  </div>
                  <div>
                    <p className="font-semibold">FBA 500 Pack</p>
                    <p>Current Stock: {item.amazonFBA_500Quantity || 0}</p>
                    <p>Inbound: {item.amazonFBA_500_OnTheWayQuantity || 0}</p>
                    <StockLevelBar level={item.amazonFBA_500Quantity || 0} inboundLevel={item.amazonFBA_500_OnTheWayQuantity || 0} maxLevel={50} />
                  </div>
                </div>
                {showHistory[item.id] && (
                  <div className="mt-4">
                    <h4 className="text-lg font-semibold text-cyan-200 mb-2">Recent Stock History</h4>
                    <MiniBarGraph history={historyData[item.id]} />
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex space-x-2">
              {canEdit && (
                <button onClick={() => handleOpenEditModal(item)} className="w-full px-4 py-2 rounded-md bg-teal-600 hover:bg-teal-700">Edit</button>
              )}
              <button onClick={() => toggleHistory(item.id)} className="w-full px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700">History</button>
            </div>
          </div>
        ))}
      </div>
      {itemToEdit && (
// ... existing code
