# LinkedFactory Grafana Datasource Plugin
## Usage

1. Install dependencies

   ```bash
   yarn install
   ```

2. Get a Grafana API 'PluginPublisher' key and sign plugin

   ```bash
   export GRAFANA_API_KEY=your_api_key
   yarn sign --rootUrls http://localhost:3000
   ```

3. Build plugin in development mode or run in watch mode

   ```bash
   yarn dev
   ```

   or

   ```bash
   yarn watch
   ```

4. Build plugin in production mode

   ```bash
   yarn build
   ```

5. Start grafana

   ```bash
   sudo docker compose up
   ```

   LinkedFactory must be up and running.
## Learn more

- [Build a data source plugin tutorial](https://grafana.com/tutorials/build-a-data-source-plugin)
- [Grafana documentation](https://grafana.com/docs/)
- [Grafana Tutorials](https://grafana.com/tutorials/) - Grafana Tutorials are step-by-step guides that help you make the most of Grafana
- [Grafana UI Library](https://developers.grafana.com/ui) - UI components to help you build interfaces using Grafana Design System
