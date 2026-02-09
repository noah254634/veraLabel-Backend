import Dataset from "./dataset.model.js";

export const datasetService={
createDataset:async(name,description,price,datasetLabeler,datasetType,datasetFormat,file)=>{
    if(!name || !description || !price || !datasetLabeler || !datasetType || !datasetFormat || !file) throw new Error("All fields are required");
    
    const dataset=await Dataset.create({
        name,
        description,
        price,
        datasetLabeler,
        datasetType,
        datasetFormat,
        file:file.location
    })
    return dataset;


},
getAllDatasets: async () => {
    return await Dataset.find();
}
};