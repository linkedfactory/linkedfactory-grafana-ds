import { test, expect, AppConfigPage } from '@grafana/plugin-e2e';
//import { MyDataSourceOptions, MySecureJsonData } from '../src/types';

test('"Save & test" should be successful when configuration is valid', async ({
  createDataSourceConfigPage,
  readProvisionedDataSource,
  page,
}) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const configPage = await createDataSourceConfigPage({ type: ds.type });

  await page.route('http://linkedfactory.pod.com/values', async (route) =>
    await route.fulfill({ status: 200, body: 'OK' }));
  await configPage.ctx.page.locator('label:has-text("URL") + input').fill('http://linkedfactory.pod.com');
  await expect(configPage.saveAndTest({ path: 'http://linkedfactory.pod.com' })).toBeOK();

});

test('"Save & test" should display success alert box when config is valid', async ({
  createDataSourceConfigPage,
  readProvisionedDataSource,
  page
}) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const configPage = await createDataSourceConfigPage({ type: ds.type });
  await page.route('http://linkedfactory.pod.com/values', async (route) =>
    await route.fulfill({ status: 400, body: 'error' }));
  await configPage.ctx.page.locator('label:has-text("URL") + input').fill('http://linkedfactory.pod.com');
  configPage.saveAndTest({ path: 'http://linkedfactory.pod.com' })
  await expect(configPage).toHaveAlert('error');
});
