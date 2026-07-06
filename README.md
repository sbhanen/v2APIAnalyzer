This is a semi automated way of capturing API calls from SAP Service Cloud V2 to SAP S/4HANA for utility processes.

The idea is that we save the har file, and then create a simple display of the content.

To install the typescript files, just download as zip file and then unpack on your computer. Place the .har file (see how to download below) in the same folder as the viwer. open the viewer.html in your browser and select the .har file.

Below is a screenshot of the viewer after selecting a .har file
<img width="1339" height="753" alt="image" src="https://github.com/user-attachments/assets/a9bece61-a968-443d-9453-176156381f42" />


Example, if you want to capture what API's are called for the move-in process, then:

1. Go to the Premise tab in SAP Service Cloud and then open your browser in inspection mode (below is from using Edge).
2. Then select the netword tab (1)
3. Then clear all calls that was done so far (2)
4. Execute the step or steps you want to look at later in SAP Service Cloud
5. After the process download the har file (3)
6. In the viwer, select the downloaded file.


<img width="971" height="361" alt="image" src="https://github.com/user-attachments/assets/410b3d18-4543-457e-b8fe-fe33ac292951" />



