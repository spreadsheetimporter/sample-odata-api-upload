import MessageBox from "sap/m/MessageBox";
import BaseController from "./BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import Select from "sap/m/Select";
import Table from "sap/m/Table";
import Column from "sap/m/Column";
import Text from "sap/m/Text";
import ColumnListItem from "sap/m/ColumnListItem";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Item from "sap/ui/core/Item";

/**
 * @namespace com.spreadsheetimporter.apiupload.controller
 */
export default class Main extends BaseController {
	private oDataModel: any;

	public onInit(): void {
		this.oDataModel = this.getOwnerComponent().getModel("catalogService");

		// Select the sample service and trigger change event
		setTimeout(() => {
			const oServiceSelect = this.byId("serviceSelect") as Select;
			oServiceSelect.setSelectedKey("ZGWSAMPLE_BASIC_0001");
			oServiceSelect.fireEvent("change", { selectedItem: oServiceSelect.getSelectedItem() });

			// Wait for entity sets to load, then select SALESORDERSET
			setTimeout(() => {
				const oEntitySetSelect = this.byId("entitySetSelect") as Select;
				oEntitySetSelect.setSelectedKey("SALESORDERSET");
				oEntitySetSelect.fireEvent("change", { selectedItem: oEntitySetSelect.getSelectedItem() });
			}, 1000); // Adjust this delay if needed
		}, 0);
	}

	public onServiceChange(event: Event): void {
		const serviceSelect = event.getSource() as Select;
		const selectedKey = serviceSelect.getSelectedKey();

		if (selectedKey) {
			this.loadEntitySets(selectedKey);
		} else {
			this.byId("entitySetSelect").setVisible(false);
			this.byId("dynamicTable").setVisible(false);
		}
	}

	public onEntitySetChange(oEvent: Event): void {
		const entitySetSelect = oEvent.getSource() as Select;
		const selectedKey = entitySetSelect.getSelectedKey();
		const serviceSelect = this.byId("serviceSelect") as Select;
		const selectedItem = serviceSelect.getSelectedItem();
		const selectedItemObject = selectedItem
			.getBindingContext("catalogService")
			.getObject();
		const selectedText = entitySetSelect
			.getSelectedItem()
			.getBindingContext("entitySets")
			.getObject().text;

		if (selectedKey) {
			this.createDynamicTable(selectedItemObject.Description, selectedText);
		} else {
			this.byId("dynamicTable").setVisible(false);
		}
	}

	private async loadEntitySets(serviceId: string): void {
		// Get the service URL from the service select
		// const serviceSelect = this.byId("serviceSelect") as Select;
		// const selectedItem = serviceSelect.getSelectedItem();
		// const selectedItemObject = selectedItem
		// 	.getBindingContext("catalogService")
		// 	.getObject();
		// const parsedUrl = new URL(selectedItemObject.ServiceUrl);
		// // Create a new OData model for the selected service
		// const selectedServiceModel = new ODataModel(parsedUrl.pathname);

		// await selectedServiceModel.getMetaModel().loaded();

		// const metadata = selectedServiceModel.getMetaModel().getObject("/");

		this.oDataModel.read(`/ServiceCollection('${serviceId}')/EntitySets`, {
			success: (oData: any) => {
				const entitySetSelect = this.byId("entitySetSelect") as Select;
				const entitySets = oData.results.map((entitySet: any) => ({
					key: entitySet.ID,
					text: entitySet.Description || entitySet.ID,
				}));

				const entitySetModel = new JSONModel(entitySets);
				entitySetSelect.setModel(entitySetModel, "entitySets");
				entitySetSelect.bindItems({
					path: "entitySets>/",
					template: new Item({
						key: "{entitySets>key}",
						text: "{entitySets>text}",
					}),
				});

				entitySetSelect.setVisible(true);
			},
			error: (oError: any) => {
				MessageBox.error("Failed to load EntitySets");
			},
		});
	}

	private async createDynamicTable(
		serviceId: string,
		entitySetId: string
	): void {
		// Get the service URL from the service select
		const serviceSelect = this.byId("serviceSelect") as Select;
		const selectedItem = serviceSelect.getSelectedItem();
		const selectedItemObject = selectedItem
			.getBindingContext("catalogService")
			.getObject();
		const serviceUrl = typeof selectedItemObject.ServiceUrl === 'string' ? selectedItemObject.ServiceUrl : '';
		const parsedUrl = new URL(serviceUrl);

		// Create a new OData model for the selected service
		const selectedServiceModel = new ODataModel(parsedUrl.pathname);

		// Use the new model to get metadata and create the table
		await selectedServiceModel.getMetaModel().loaded();

		const entitySets = selectedServiceModel
			.getMetaModel()
			.getODataEntityContainer().entitySet;
		// find entitySet by entitySetId from entitySets
		const entitySet = entitySets.find(
			(entitySet: any) => entitySet.name === entitySetId
		);

		const entityType = selectedServiceModel
			.getMetaModel()
			.getODataEntityType(entitySet.entityType);
		const dynamicTable = this.byId("dynamicTable") as Table;

		dynamicTable.removeAllColumns();
		dynamicTable.unbindItems();

		// Create columns based on entity properties
		entityType.property.forEach((property: any) => {
			dynamicTable.addColumn(
				new Column({
					header: new Text({ text: property.name }),
				})
			);
		});

		// Create template for items
		const template = new ColumnListItem({
			cells: entityType.property.map((property: any) => {
				return new Text({ text: `{${property.name}}` });
			}),
		});

		// Bind items to the table using the new model
		dynamicTable.setModel(selectedServiceModel);
		dynamicTable.bindItems({
			path: `/${entitySetId}`,
			template: template,
		});

		dynamicTable.setVisible(true);
	}

	async onUpload(): void {
		this.spreadsheetUpload = await this.getView()
			.getController()
			.getOwnerComponent()
			.createComponent({
				usage: "spreadsheetImporter",
				async: true,
				componentData: {
					context: this,
					
				},
			});
		this.spreadsheetUpload.openSpreadsheetUploadDialog();
	}
}