output = function() {
  $.db.ensureIndex($.options,
    function(err) {
    if(err) {
      output({error: $.create(err)});
    } else {
      output({db: $.get('db')});
    }
  });
};
