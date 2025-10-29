import { test, expect, PanelEditPage } from '@grafana/plugin-e2e';

test('data query should return a value', async ({ panelEditPage, readProvisionedDataSource, page }) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  await panelEditPage.datasource.set(ds.name);
  await panelEditPage.setVisualization('Table');
  await panelEditPage.getQueryEditorRow('A').getByRole('combobox', { name: 'Item' }).waitFor({ state: 'visible' });
  await panelEditPage.getQueryEditorRow('A').getByRole('combobox', { name: 'Item' }).fill('item test');
  await panelEditPage.getQueryEditorRow('A').getByRole('combobox', { name: 'Property' }).fill('property test');
  await expect(panelEditPage.panel.fieldNames).toContainText(['Value', 'Time']);
  await expect(panelEditPage.panel.data).toContainText([]);

});

