export const CsvFormatInstructions = () => (
  <div className="bg-slate-900/50 p-4 rounded-lg mt-4 text-slate-300 text-sm">
    <h4 className="font-semibold text-slate-200 mb-2">CSV Format Requirements:</h4>
    <p>The CSV file must contain a header row with the following columns:</p>
    <code className="block bg-slate-800 p-2 rounded-md my-2 text-xs text-cyan-300">
      sku,date,field,oldValue,newValue,changedByEmail
    </code>
    <ul className="list-disc list-inside space-y-2 pl-2">
      <li>
        <strong>sku:</strong> The SKU of the item. Must match an existing item in the selected
        inventory.
      </li>
      <li>
        <strong>date:</strong> The date of the history event (e.g., "2024-05-25T10:00:00Z"). Must be
        a valid date format.
      </li>
      <li>
        <strong>field:</strong> The specific stock quantity that was changed. The valid names depend
        on the inventory type you are uploading for:
        <ul className="list-['-'] list-inside pl-4 mt-1 space-y-1">
          <li>
            For <strong>Devices</strong>, valid fields are:{' '}
            <code className="text-xs text-cyan-300">onlineStock</code>,{' '}
            <code className="text-xs text-cyan-300">productionStock</code>,{' '}
            <code className="text-xs text-cyan-300">warehouseStock</code>,{' '}
            <code className="text-xs text-cyan-300">reserveStock</code>.
          </li>
          <li>
            For <strong>Components</strong>, valid fields are:{' '}
            <code className="text-xs text-cyan-300">onlineStock</code>,{' '}
            <code className="text-xs text-cyan-300">countedStock</code>.
          </li>
        </ul>
      </li>
      <li>
        <strong>oldValue:</strong> The stock quantity before the change.
      </li>
      <li>
        <strong>newValue:</strong> The stock quantity after the change.
      </li>
      <li>
        <strong>changedByEmail:</strong> (Optional) The email of the user who made the change.
        Defaults to "Manual Upload".
      </li>
    </ul>
  </div>
);

export const SalesCsvInstructions = () => (
  <div className="bg-slate-900/50 p-4 rounded-lg mt-4 text-slate-300 text-sm">
    <h4 className="font-semibold text-slate-200 mb-2">Sales Data CSV Format:</h4>
    <p>The CSV file must contain a header row with the following columns:</p>
    <code className="block bg-slate-800 p-2 rounded-md my-2 text-xs text-cyan-300">
      sku,netSales,year,week
    </code>
    <ul className="list-disc list-inside space-y-1 pl-2">
      <li>
        <strong>sku:</strong> The SKU of the item sold.
      </li>
      <li>
        <strong>netSales:</strong> The total number of units sold for that week.
      </li>
      <li>
        <strong>year:</strong> The year of the sales week (e.g., 2024).
      </li>
      <li>
        <strong>week:</strong> The week number of the year (1-52).
      </li>
    </ul>
  </div>
);
